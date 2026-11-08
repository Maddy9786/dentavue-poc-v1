# ============================================================
# Step 1: Resource Group (foundation — everything depends on it)
# ============================================================
module "resource_group" {
  source = "../../modules/azurerm-resource-group"
  config = var.resource_groups
}

# ============================================================
# Step 2: Virtual Network (depends on RG)
# ============================================================
module "virtual_network" {
  source = "../../modules/azurerm-virtualnetwork"
  config = var.vnets

  depends_on = [module.resource_group]
}

# ============================================================
# Step 3a: Subnet (depends on VNet being fully created)
# ============================================================
module "subnet" {
  source = "../../modules/azurerm-subnets"
  config = var.subnets

  depends_on = [module.virtual_network]
}

# ============================================================
# Step 3b: Public IP (parallel with subnet, depends on RG)
# ============================================================
module "public_ip" {
  source = "../../modules/azurerm-publicip"
  config = var.public_ips

  depends_on = [module.resource_group]
}

# ============================================================
# Step 3c: NSG (parallel with subnet & pip, depends on RG)
# ============================================================
module "nsg" {
  source = "../../modules/azurerm-nsg"
  config = var.nsgs

  depends_on = [module.resource_group]
}

# ============================================================
# Step 4: Linux VM with NIC + NSG association
#         Depends on: subnet, public_ip, nsg all being ready
# ============================================================
module "linux_vm" {
  source = "../../modules/azurerm-linux-vm"
  config = {
    for k, v in var.vms : k => merge(v, {
      subnet_id    = module.subnet.id
      public_ip_id = module.public_ip.id
      nsg_id       = module.nsg.id
    })
  }

  depends_on = [module.subnet, module.public_ip, module.nsg]
}

# ============================================================
# Step 5: Save generated SSH private key locally
# ============================================================
resource "local_file" "ssh_private_key" {
  content         = module.linux_vm.tls_private_key_pem
  filename        = "${path.module}/id_rsa_dentavue.pem"
  file_permission = "0600"

  depends_on = [module.linux_vm]
}
