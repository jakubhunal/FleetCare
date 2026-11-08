/** Display-only names; stored records, categories and free-text titles stay intact. */
export function deadlineTitle(
  type: "STK" | "Pojištění" | "Oprávnění" | "Kvalifikace" | "Servis",
  subject: string,
  detail = "",
) {
  const labels = {
    STK: "Platnost STK",
    Pojištění: "Platnost pojištění",
    Oprávnění: `Platnost řidičského oprávnění ${detail}`,
    Kvalifikace: `Platnost kvalifikace ${detail}`,
    Servis: `Servisní plán: ${detail}`,
  };
  return `${labels[type].trim()} – ${subject}`;
}
