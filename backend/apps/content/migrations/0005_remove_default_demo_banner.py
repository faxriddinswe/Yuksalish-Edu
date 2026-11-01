from django.db import migrations


def update_defaults(apps, schema_editor):
    settings = apps.get_model("content", "SiteSettings")
    settings.objects.filter(
        announcement="Namuna muhiti — bu yerda sun’iy demo ma’lumotlar bor."
    ).update(announcement="")
    settings.objects.filter(
        about="Yuksalish Edu o‘quv markazi. Bu lokal namuna muhiti; ta’lim dasturi va haqiqiy markaz ma’lumotlari keyin tasdiqlanadi."
    ).update(
        about="Yuksalish Edu — fanlarni izchil o‘rganishga yo‘naltirilgan repetitorlik o‘quv markazi. Kursni tanlang, jadval va guruhni administrator bilan kelishing. O‘quvchi hamda biriktirilgan ota-ona dars jadvali, davomat va to‘lov holatini shaxsiy kabinetda kuzatishi mumkin."
    )


class Migration(migrations.Migration):
    dependencies = [("content", "0004_achievement_achieved_on_achievement_teacher_and_more")]
    operations = [migrations.RunPython(update_defaults, migrations.RunPython.noop)]
