output "name" {
  value = values(azurerm_virtual_network.vnet)[0].name
}

output "id" {
  value = values(azurerm_virtual_network.vnet)[0].id
}
