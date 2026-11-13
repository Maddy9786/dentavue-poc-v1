output "resource_group_name" {
  description = "The deployed Resource Group name"
  value       = module.resource_group.name
}

output "public_ip_address" {
  description = "The Public IP address of the DentaVue VM"
  value       = module.public_ip.ip_address
}

output "ssh_command" {
  description = "SSH connection command for the VM"
  value       = "ssh -i id_rsa_dentavue.pem ${values(var.vms)[0].admin_username}@${module.public_ip.ip_address}"
}

output "application_url" {
  description = "HTTP URL to access DentaVue on the VM"
  value       = "http://${module.public_ip.ip_address}"
}
