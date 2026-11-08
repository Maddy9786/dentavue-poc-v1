# Network Interface for VM
resource "azurerm_network_interface" "nic" {
  for_each = var.config

  name                = each.value.nic_name
  location            = each.value.location
  resource_group_name = each.value.resource_group_name
  tags                = lookup(each.value, "tags", {})

  ip_configuration {
    name                          = "internal"
    subnet_id                     = each.value.subnet_id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = each.value.public_ip_id
  }
}

# Attach NSG to NIC
resource "azurerm_network_interface_security_group_association" "nic_nsg_assoc" {
  for_each = var.config

  network_interface_id      = azurerm_network_interface.nic[each.key].id
  network_security_group_id = each.value.nsg_id
}

# Generate an SSH key if none provided
resource "tls_private_key" "vm_ssh_key" {
  for_each  = var.config
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Azure Linux Virtual Machine
resource "azurerm_linux_virtual_machine" "vm" {
  for_each = var.config

  name                = each.value.vm_name
  resource_group_name = each.value.resource_group_name
  location            = each.value.location
  size                = each.value.vm_size
  admin_username      = each.value.admin_username
  tags                = lookup(each.value, "tags", {})

  network_interface_ids = [
    azurerm_network_interface.nic[each.key].id,
  ]

  admin_ssh_key {
    username   = each.value.admin_username
    public_key = lookup(each.value, "admin_ssh_public_key", null) != null ? each.value.admin_ssh_public_key : tls_private_key.vm_ssh_key[each.key].public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = lookup(each.value, "disk_size_gb", 30)
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # Update packages
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release git

    # Create 2GB Swap space (protects small 1GB/2GB RAM VMs from OOM)
    if [ ! -f /swapfile ]; then
      fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    # Add Docker GPG key & repo
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker & Docker Compose
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    # Add admin user to docker group
    usermod -aG docker ${each.value.admin_username}

    # Create systemd service to auto-start DentaVue Docker Compose stack on every VM boot
    cat << 'SERVICE' > /etc/systemd/system/dentavue.service
    [Unit]
    Description=DentaVue Docker Compose Application Stack
    Requires=docker.service
    After=docker.service network-online.target
    Wants=network-online.target

    [Service]
    Type=oneshot
    RemainAfterExit=yes
    WorkingDirectory=/home/${each.value.admin_username}/dentavue
    ExecStart=/usr/bin/docker compose up -d
    ExecStop=/usr/bin/docker compose stop
    TimeoutStartSec=0

    [Install]
    WantedBy=multi-user.target
    SERVICE
    systemctl daemon-reload
    systemctl enable dentavue.service

    echo "Docker and Docker Compose installation complete!"
  EOF
  )
}

# Nightly Auto-Shutdown Schedule (Deallocates VM at night to save cost)
resource "azurerm_dev_test_global_vm_shutdown_schedule" "auto_shutdown" {
  for_each = var.config

  virtual_machine_id    = azurerm_linux_virtual_machine.vm[each.key].id
  location              = each.value.location
  enabled               = lookup(each.value, "auto_shutdown_enabled", true)
  daily_recurrence_time = lookup(each.value, "auto_shutdown_time", "2300")
  timezone              = lookup(each.value, "auto_shutdown_timezone", "India Standard Time")

  notification_settings {
    enabled = false
  }

  tags = lookup(each.value, "tags", {})
}
