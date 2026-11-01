from django.contrib import admin
from .models import Invoice, Payment, PaymentAllocation, Adjustment


class FinancialReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


for model in [Invoice, Payment, PaymentAllocation, Adjustment]:
    admin.site.register(model, FinancialReadOnlyAdmin)
