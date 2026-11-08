output "vm_id" {
  value = values(azurerm_linux_virtual_machine.vm)[0].id
}

output "vm_name" {
  value = values(azurerm_linux_virtual_machine.vm)[0].name
}

output "nic_id" {
  value = values(azurerm_network_interface.nic)[0].id
}

output "private_ip_address" {
  value = values(azurerm_network_interface.nic)[0].private_ip_address
}

output "tls_private_key_pem" {
  value     = values(tls_private_key.vm_ssh_key)[0].private_key_pem
  sensitive = true
}
