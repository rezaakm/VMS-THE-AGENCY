import { useEffect, useState } from "react";

const COMMON_EVENT_ITEMS = [
  "Stage Setup",
  "LED Screen / Video Wall",
  "Audio System (PA)",
  "Lighting Rig",
  "Truss Structure",
  "Backdrop Fabrication",
  "Branded Signage",
  "Step & Repeat Banner",
  "Registration Desk",
  "Reception Counter",
  "Carpet Flooring",
  "Floral Arrangements",
  "Table Centrepieces",
  "Tent / Marquee",
  "Chairs (Chiavari)",
  "Round Tables",
  "Cocktail Tables",
  "Buffet Setup",
  "Catering (per person)",
  "Welcome Drinks",
  "Photography",
  "Videography",
  "Live Streaming Setup",
  "Photo Booth",
  "MC / Host",
  "DJ & Sound",
  "Band Performance",
  "Entertainment Act",
  "Corporate Gift Items",
  "Branded Giveaways",
  "Event Programme / Booklet",
  "Foam Board Print",
  "Forex Board Print",
  "Vinyl Sticker",
  "Roll-Up Banner",
  "Crowd Barrier",
  "Security Personnel",
  "Ushers / Hostesses",
  "Transportation / Logistics",
  "Labour / Manpower",
  "Generator",
  "Air Conditioning Unit",
  "Cleaning Services",
  "Miscellaneous",
];

export function useItemSuggestions() {
  const [dbSuggestions, setDbSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/suggestions/item-descriptions")
      .then((r) => r.json())
      .then((data: string[]) => setDbSuggestions(data))
      .catch(() => {});
  }, []);

  const all = Array.from(
    new Set([...dbSuggestions, ...COMMON_EVENT_ITEMS])
  );

  return all;
}
