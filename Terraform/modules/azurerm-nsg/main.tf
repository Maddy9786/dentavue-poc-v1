resource "azurerm_network_security_group" "nsg" {
  for_each = var.config

  name                = each.value.name
  location            = each.value.location
  resource_group_name = each.value.resource_group_name
  tags                = lookup(each.value, "tags", {})

  dynamic "security_rule" {
    for_each = lookup(each.value, "security_rules", [])
    content {
      name                       = security_rule.value.name
      priority                   = security_rule.value.priority
      direction                  = lookup(security_rule.value, "direction", "Inbound")
      access                     = lookup(security_rule.value, "access", "Allow")
      protocol                   = lookup(security_rule.value, "protocol", "Tcp")
      source_port_range          = lookup(security_rule.value, "source_port_range", "*")
      destination_port_range     = security_rule.value.destination_port_range
      source_address_prefix      = lookup(security_rule.value, "source_address_prefix", "*")
      destination_address_prefix = lookup(security_rule.value, "destination_address_prefix", "*")
    }
  }
}
