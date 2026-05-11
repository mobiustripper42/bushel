"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";
import { createCustomer, updateCustomer, type CustomerInput } from "@/actions/customers";

type Customer = Tables<"customers">;

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--ink-700)",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "0.9rem",
  background: "var(--paper)",
  border: "1px solid var(--ink-200)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-900)",
  fontFamily: "var(--font-sans)",
};

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [name, setName] = useState(customer?.name ?? "");
  const [businessName, setBusinessName] = useState(customer?.business_name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.delivery_address ?? "");
  const [priority, setPriority] = useState(String(customer?.priority ?? 100));
  const [sendWeeklyLink, setSendWeeklyLink] = useState(customer?.send_weekly_link ?? true);
  const [isActive, setIsActive] = useState(customer?.is_active ?? true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const input: CustomerInput = {
      name,
      business_name: businessName,
      email,
      phone,
      delivery_address: deliveryAddress,
      priority: parseInt(priority, 10),
      send_weekly_link: sendWeeklyLink,
      is_active: isActive,
    };
    startTransition(async () => {
      if (customer) {
        const err = await updateCustomer(customer.id, input);
        if (err) setError(err);
        else setSaved(true);
      } else {
        const result = await createCustomer(input);
        if (result.error) setError(result.error);
        else router.push("/admin/customers");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 18,
        maxWidth: 720,
        background: "var(--paper)",
        padding: 24,
        borderRadius: "var(--r-lg)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <label style={fieldStyle}>
        <span style={labelStyle}>Name *</span>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required aria-label="Name" />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Business name</span>
        <input style={inputStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} aria-label="Business name" />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Email</span>
        <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Phone</span>
        <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" />
      </label>

      <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
        <span style={labelStyle}>Delivery address</span>
        <input style={inputStyle} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} aria-label="Delivery address" />
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Priority (lower = sends earlier)</span>
        <input
          style={inputStyle}
          type="number"
          min="0"
          step="1"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
        />
      </label>

      <div style={{ ...fieldStyle, justifyContent: "flex-end" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={sendWeeklyLink}
            onChange={(e) => setSendWeeklyLink(e.target.checked)}
            aria-label="Send weekly link"
            style={{ width: 16, height: 16, accentColor: "var(--leaf-600)" }}
          />
          <span>Send weekly link</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            aria-label="Active"
            style={{ width: 16, height: 16, accentColor: "var(--leaf-600)" }}
          />
          <span>Active</span>
        </label>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "8px 18px",
            fontSize: "0.9rem",
            fontWeight: 600,
            background: "var(--leaf-600)",
            color: "var(--paper)",
            border: "none",
            borderRadius: "var(--r-sm)",
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : customer ? "Save changes" : "Create customer"}
        </button>
        {saved && <span style={{ fontSize: "0.85rem", color: "var(--leaf-700)" }}>Saved</span>}
        {error && <span role="alert" style={{ fontSize: "0.85rem", color: "var(--destructive)" }}>{error}</span>}
      </div>
    </form>
  );
}
