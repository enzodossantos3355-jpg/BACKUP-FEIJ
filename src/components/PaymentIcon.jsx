import React from "react";
import {
  QrCode,
  Money,
  CreditCard,
  Clock,
  Wallet,
  Question,
} from "@phosphor-icons/react";

export const PAYMENT_META = {
  "Pix": {
    label: "Pix",
    icon: QrCode,
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    color: "#0D9488",
  },
  "pix": {
    label: "Pix",
    icon: QrCode,
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    color: "#0D9488",
  },
  "Dinheiro": {
    label: "Dinheiro",
    icon: Money,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    color: "#059669",
  },
  "dinheiro": {
    label: "Dinheiro",
    icon: Money,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    color: "#059669",
  },
  "Cartão Crédito": {
    label: "Cartão Crédito",
    icon: CreditCard,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    color: "#2563EB",
  },
  "cartao_credito": {
    label: "Cartão Crédito",
    icon: CreditCard,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    color: "#2563EB",
  },
  "Cartão Débito": {
    label: "Cartão Débito",
    icon: CreditCard,
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    color: "#0284C7",
  },
  "cartao_debito": {
    label: "Cartão Débito",
    icon: CreditCard,
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    color: "#0284C7",
  },
  "Pendente": {
    label: "Pendente",
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    color: "#D97706",
  },
  "pendente": {
    label: "Pendente",
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    color: "#D97706",
  },
  "Outro": {
    label: "Outro",
    icon: Wallet,
    badgeClass: "bg-stone-50 text-stone-700 border-stone-200",
    color: "#57534E",
  },
  "outro": {
    label: "Outro",
    icon: Wallet,
    badgeClass: "bg-stone-50 text-stone-700 border-stone-200",
    color: "#57534E",
  },
};

const defaultMeta = {
  label: "Desconhecido",
  icon: Question,
  badgeClass: "bg-stone-50 text-stone-700 border-stone-200",
  color: "#78716C",
};

export function getPaymentMeta(method) {
  if (!method) return defaultMeta;
  return PAYMENT_META[method] || PAYMENT_META[String(method).toLowerCase()] || {
    ...defaultMeta,
    label: method,
  };
}

export default function PaymentIcon({ method, size = 18, className = "" }) {
  const meta = getPaymentMeta(method);
  const Icon = meta.icon;
  return <Icon size={size} className={className} weight="duotone" />;
}

export function PaymentBadge({ method, size = "sm" }) {
  const meta = getPaymentMeta(method);
  const Icon = meta.icon;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-sm px-2.5 py-1 gap-1.5",
  }[size] || "text-xs px-2 py-0.5 gap-1.5";

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 16,
  }[size] || 14;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${meta.badgeClass} ${sizeClasses}`}
    >
      <Icon size={iconSizes} weight="fill" />
      <span>{meta.label}</span>
    </span>
  );
}
