from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, inline_serializer
from common.schema import MESSAGE, USER, SESSION
from apps.audit.services import audit
from .models import normalize_phone
from .services import rate_limit, redeem_invitation


def user_data(user):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "phone": user.phone,
        "roles": user.roles,
        "extra_permissions": user.extra_permissions,
        "is_active": user.is_active,
    }


class LoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30)
    password = serializers.CharField(max_length=128, write_only=True)


@method_decorator(csrf_protect, name="dispatch")
class SessionView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses={200: SESSION})
    def get(self, request):
        return Response(
            {
                "csrfToken": get_token(request),
                "user": user_data(request.user) if request.user.is_authenticated else None,
            }
        )

    @extend_schema(request=LoginSerializer, responses={200: SESSION})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        rate_limit("login-ip:" + request.META.get("REMOTE_ADDR", ""), 40)
        try:
            phone = normalize_phone(data["phone"])
        except Exception:
            phone = "invalid"
        rate_limit("login-account:" + phone, 10)
        user = authenticate(request, phone=phone, password=data["password"])
        if not user:
            return Response({"error": {"message": "Telefon yoki parol noto‘g‘ri."}}, status=400)
        login(request, user)
        audit(user, "account.login", user)
        return Response({"user": user_data(user), "csrfToken": get_token(request)})

    @extend_schema(request=None, responses={200: MESSAGE})
    def delete(self, request):
        if request.user.is_authenticated:
            audit(request.user, "account.logout", request.user)
        logout(request)
        return Response({"message": "Tizimdan chiqdingiz."})


@method_decorator(csrf_protect, name="dispatch")
class ActivateView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        request=inline_serializer(
            "ActivationRequest",
            fields={
                "phone": serializers.CharField(),
                "code": serializers.CharField(write_only=True),
                "password": serializers.CharField(write_only=True),
                "purpose": serializers.ChoiceField(choices=["ACTIVATE", "RESET"], default="ACTIVATE"),
            },
        ),
        responses={
            200: {
                "type": "object",
                "properties": {"message": {"type": "string"}, "user_id": {"type": "integer"}},
            }
        },
    )
    def post(self, request):
        rate_limit("activation-ip:" + request.META.get("REMOTE_ADDR", ""), 25)
        data = request.data
        if not all(isinstance(data.get(x), str) and data.get(x) for x in ["phone", "code", "password"]):
            raise serializers.ValidationError("Telefon, kod va parol kerak.")
        user = redeem_invitation(
            data["phone"], data["code"], data["password"], data.get("purpose", "ACTIVATE")
        )
        return Response({"message": "Parol belgilandi. Endi tizimga kiring.", "user_id": user.id})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: USER})
    def get(self, request):
        return Response(user_data(request.user))

    @extend_schema(
        request=inline_serializer(
            "PasswordChangeRequest",
            fields={
                "old_password": serializers.CharField(write_only=True),
                "new_password": serializers.CharField(write_only=True),
            },
        ),
        responses={200: MESSAGE},
    )
    def patch(self, request):
        password = request.data.get("new_password", "")
        if not request.user.check_password(request.data.get("old_password", "")):
            raise serializers.ValidationError({"old_password": "Amaldagi parol noto‘g‘ri."})
        validate_password(password, request.user)
        request.user.set_password(password)
        request.user.save()
        update_session_auth_hash(request, request.user)
        audit(request.user, "account.password_changed", request.user)
        return Response({"message": "Parol o‘zgartirildi."})
