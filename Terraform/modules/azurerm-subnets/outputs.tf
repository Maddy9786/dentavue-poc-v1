output "name" {
  value = values(azurerm_subnet.subnet)[0].name
}

output "id" {
  value = values(azurerm_subnet.subnet)[0].id
}
