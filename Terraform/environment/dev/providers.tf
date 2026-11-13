terraform {
  required_version = ">= 1.5.0"

  # ==============================================================================
  # Remote State Backend (Azure Blob Storage)
  # ==============================================================================
  # Reference: Jab aap manual Storage Account create kar lein, toh niche diye
  # block ko uncomment karke run karein: `terraform init -migrate-state`
  #
  # Azure resources required:
  # 1. Resource Group:  rg-dentavue-tfstate
  # 2. Storage Account: stdentavuetfstate (globally unique, lowercase only)
  # 3. Blob Container:  tfstate
  #
  backend "azurerm" {
    resource_group_name  = "rg-dentavue-tfstate"
    storage_account_name = "stdentavuetfstate"
    container_name       = "tfstate"
    key                  = "dev.dentavue.terraform.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

provider "azurerm" {
  features {}
}
