output "name" {
  value = values(azurerm_public_ip.pip)[0].name
}

output "id" {
  value = values(azurerm_public_ip.pip)[0].id
}

output "ip_address" {
  value = values(azurerm_public_ip.pip)[0].ip_address
}
