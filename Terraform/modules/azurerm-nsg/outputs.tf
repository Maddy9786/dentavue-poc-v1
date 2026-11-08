output "name" {
  value = values(azurerm_network_security_group.nsg)[0].name
}

output "id" {
  value = values(azurerm_network_security_group.nsg)[0].id
}
