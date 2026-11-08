resource "azurerm_resource_group" "rg" {
  for_each = var.config

  name     = each.value.name
  location = each.value.location
  tags     = lookup(each.value, "tags", {})
}
