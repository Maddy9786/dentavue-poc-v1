output "name" {
  value = values(azurerm_resource_group.rg)[0].name
}

output "location" {
  value = values(azurerm_resource_group.rg)[0].location
}

output "id" {
  value = values(azurerm_resource_group.rg)[0].id
}
