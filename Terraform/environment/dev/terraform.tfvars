resource_groups = {
  rg1 = {
    name     = "DentaVue-Resource-Group"
    location = "uksouth"
    tags = {
      Environment = "POC"
      Project     = "DentaVue"
      ManagedBy   = "Terraform"
    }
  }
}

vnets = {
  vnet1 = {
    name                = "DentaVue-VNET"
    location            = "uksouth"
    resource_group_name = "DentaVue-Resource-Group"
    address_space       = ["10.0.0.0/16"]
    tags = {
      Environment = "POC"
      Project     = "DentaVue"
      ManagedBy   = "Terraform"
    }
  }
}

subnets = {
  subnet1 = {
    name                 = "DentaVue-Public-subnet"
    resource_group_name  = "DentaVue-Resource-Group"
    virtual_network_name = "DentaVue-VNET"
    address_prefixes     = ["10.0.1.0/24"]
  }
}

public_ips = {
  pip1 = {
    name                = "DentaVue-Public-IP"
    location            = "uksouth"
    resource_group_name = "DentaVue-Resource-Group"
    allocation_method   = "Static"
    sku                 = "Standard"
    tags = {
      Environment = "POC"
      Project     = "DentaVue"
      ManagedBy   = "Terraform"
    }
  }
}

nsgs = {
  nsg1 = {
    name                = "DentaVue-NSG"
    location            = "uksouth"
    resource_group_name = "DentaVue-Resource-Group"
    tags = {
      Environment = "POC"
      Project     = "DentaVue"
      ManagedBy   = "Terraform"
    }
    security_rules = [
      {
        name                   = "Allow-SSH"
        priority               = 100
        destination_port_range = "22"
      },
      {
        name                   = "Allow-HTTP"
        priority               = 110
        destination_port_range = "80"
      },
      {
        name                   = "Allow-HTTPS"
        priority               = 120
        destination_port_range = "443"
      },
      {
        name                   = "Allow-HTTP-8080"
        priority               = 130
        destination_port_range = "8080"
      }
    ]
  }
}

vms = {
  vm1 = {
    vm_name             = "DentaVue-VM"
    nic_name            = "DentaVue-NIC"
    location            = "uksouth"
    resource_group_name = "DentaVue-Resource-Group"
    vm_size                = "Standard_F1als_v7"
    admin_username         = "azureuser"
    disk_size_gb           = 30
    auto_shutdown_enabled  = true
    auto_shutdown_time     = "2300"
    auto_shutdown_timezone = "India Standard Time"
    tags = {
      Environment = "POC"
      Project     = "DentaVue"
      ManagedBy   = "Terraform"
    }
  }
}
