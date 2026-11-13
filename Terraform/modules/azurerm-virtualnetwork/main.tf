resource "azurerm_virtual_network" "vnet" {
  for_each = var.config

  name                = each.value.name
  location            = each.value.location
  resource_group_name = each.value.resource_group_name
  address_space       = each.value.address_space
  tags                = lookup(each.value, "tags", {})
}
