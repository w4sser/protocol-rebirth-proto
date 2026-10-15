# Bespoke icon set: 24px grid, 1.75 stroke, round caps, currentColor; accents via var(--ic-accent).
import json,os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
A='var(--ic-accent,#7ff3ff)'
I={
# nav
'nav-base':'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5h4v5"/>',
'nav-raid':'<path d="M5 19 19 5"/><path d="M19 19 5 5"/><path d="M14.5 5H19v4.5M9.5 5H5v4.5"/><path d="M7 15l2 2M17 15l-2 2"/>',
'nav-stash':'<rect x="4.5" y="7" width="15" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M4.5 12h15"/><path d="M11 12v2h2v-2"/>',
'nav-shop':'<path d="M4 9h16l-1.2 10.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2"/><circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none"/>',
'nav-bit':'<rect x="5" y="7" width="14" height="11" rx="3.5"/><path d="M12 7V4.5"/><circle cx="12" cy="3.8" r=".9" fill="currentColor" stroke="none"/><path d="M9.2 12h.01M14.8 12h.01" stroke-width="2.6"/><path d="M9.5 15h5"/>',
'nav-back':'<path d="M15 5 8 12l7 7"/>',
'close':'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
'settings':'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
'map':'<path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
'mission':'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
# currencies
'cur-scrap':'<path d="M12 3.5 19.4 7.8v8.4L12 20.5l-7.4-4.3V7.8z"/><circle cx="12" cy="12" r="2.8"/>',
'cur-datacore':'<path d="M12 3 19 12l-7 9-7-9z"/><path d="M5 12h14M12 3v18" opacity=".5"/>',
'cur-signals':'<path d="M12 13v7.5"/><circle cx="12" cy="11.5" r="1.6"/><path d="M8.3 8a5.2 5.2 0 0 0 0 7M15.7 8a5.2 5.2 0 0 1 0 7M5.4 5.4a9 9 0 0 0 0 12.7M18.6 5.4a9 9 0 0 1 0 12.7"/>',
'cur-fuel':'<path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V20M4.5 20h12"/><path d="M8.5 8h4"/><path d="M15 10h1.5a1.5 1.5 0 0 1 1.5 1.5v5a1.2 1.2 0 0 0 2.4 0V9l-2.4-2.5"/>',
# rooms / modules
'room-core':'<circle cx="12" cy="12" r="2.2" fill="'+A+'" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-60 12 12)"/>',
'room-fabricator':'<path d="M4 20h16"/><path d="M6 20v-6h12v6"/><path d="M12 14V9l4-4"/><path d="M14.5 3.5 17.5 6.5"/><path d="M9 17h6"/>',
'room-storage':'<rect x="4" y="4.5" width="16" height="15" rx="2"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8V7M12 17v-1.8M8.8 12H7M17 12h-1.8"/>',
'room-bitbay':'<path d="M4 19.5h16"/><path d="M6.5 19.5v-4a5.5 5.5 0 0 1 11 0v4"/><path d="M10 14.5h.01M14 14.5h.01" stroke-width="2.4"/><path d="M12 6V3.5M8 7.5 6.5 6M16 7.5 17.5 6"/>',
'room-quarters':'<path d="M3.5 18V8M3.5 14h17v4M20.5 14v-2.5a2 2 0 0 0-2-2H11v4.5"/><circle cx="7.3" cy="11.3" r="1.6"/>',
# items
'item-carbine':'<path d="M3 11h13l2-2h3v3h-3l-1 1H9l-1.5 4.5H5L6 13H3z"/><path d="M11 13v2"/>',
'item-smg':'<path d="M4 10h12l2-1.5h2V11h-3l-1 1h-3l-1 5h-2.5l.8-5H4z"/><path d="M9 12v3.5"/>',
'item-rifle':'<path d="M2.5 11.5h15l1.5-1h2.5v2h-3l-2 1H9l-1 3.5H5.5l.7-3.5H2.5z"/><circle cx="12" cy="8" r="1.6"/><path d="M10 8h-2M14 8h2"/>',
'item-shotgun':'<path d="M3 10.5h14.5l3.5 1v1.5l-3.5 1H10l-1.5 3.5H6l1-3.5H3z"/><path d="M11 12h4"/>',
'item-vest':'<path d="M8 3.5 5 6v13.5h5.5V14h3v5.5H19V6l-3-2.5-1.5 3h-5z"/><path d="M8 11h2M14 11h2"/>',
'item-medkit':'<rect x="4" y="6.5" width="16" height="13" rx="2.5"/><path d="M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5"/><path d="M12 10v6M9 13h6" stroke="'+A+'"/>',
'item-cable':'<path d="M4 18c4 0 3-6 7-6s3 6 7 6"/><path d="M18 18V6.5M16 6.5h4M4 18V8M2.5 8h3"/>',
'item-fuse':'<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M12 3v4M12 17v4M9.5 12h5"/>',
'item-alloy':'<path d="M4 15.5 9 8h10l-5 7.5z"/><path d="M4 15.5v2.5h10l5-7.5V8"/>',
'item-powercell':'<rect x="6.5" y="5" width="11" height="15" rx="2"/><path d="M10 3h4"/><path d="M12.8 8.5 10.5 12.8h3l-2.3 4.2" stroke="'+A+'"/>',
'item-plate':'<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9.5h16M4 14.5h16M9.5 5v14M14.5 5v14" opacity=".6"/>',
'item-servo':'<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M6 18l1.8-1.8M16.2 7.8 18 6"/>',
'item-sensor':'<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6" stroke="'+A+'"/>',
'item-circuit':'<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M8.5 9h3v3h4M8.5 15h7"/><circle cx="8.5" cy="9" r="1" fill="currentColor"/><circle cx="15.5" cy="12" r="1" fill="currentColor"/>',
'item-crate':'<path d="M3.5 8 12 4l8.5 4v8.5L12 20.5l-8.5-4z"/><path d="M3.5 8 12 12l8.5-4M12 12v8.5"/>',
'item-hydraulic':'<rect x="5" y="9" width="9" height="6" rx="1"/><path d="M14 12h6M20 9.5v5M5 12H3"/><path d="M8 9V6.5h3V9"/>',
'item-memory':'<rect x="3.5" y="8" width="17" height="8" rx="1"/><path d="M6.5 16v2.5M9.5 16v2.5M12.5 16v2.5M15.5 16v2.5M7 11h3v2H7zM14 11h3v2h-3z"/>',
'item-relay':'<path d="M13 3 6 13h5l-1 8 7-10h-5z" stroke="'+A+'"/>',
'item-ai':'<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3 3 0 0 0 9 18v1.5h6V18a3 3 0 0 0 4.5-5.2A3 3 0 0 0 18 7.5a3 3 0 0 0-3-3 3 3 0 0 0-3 1 3 3 0 0 0-3-1z"/><path d="M12 5.5v13" opacity=".6"/>',
'item-bio':'<path d="M9.5 3.5h5M10.5 3.5v6L5.5 18a1.8 1.8 0 0 0 1.6 2.5h9.8a1.8 1.8 0 0 0 1.6-2.5l-5-8.5v-6"/><path d="M7.5 15h9" stroke="'+A+'"/>',
'item-chart':'<path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M8 11c2-2 4 1 6-1s3 1 3 1" stroke="'+A+'" stroke-dasharray="1.6 1.4"/>',
'item-survey':'<rect x="5.5" y="3.5" width="13" height="17" rx="1.5"/><path d="M9 3.5V5h6V3.5"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
# stats / skills
'stat-speed':'<path d="M4 8h7M2.5 12h7M4 16h7"/><path d="M13 6.5 19.5 12 13 17.5"/>',
'stat-stealth':'<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20 20 4" opacity=".7"/>',
'stat-health':'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M8 12.5h2l1-2 2 4 1-2h2" stroke="'+A+'"/>',
'stat-shield':'<path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/><path d="M12 7.5v9" opacity=".6"/>',
'stat-dash':'<path d="M13 3 6 13h5l-1 8 7-10h-5z"/>',
'stat-bag':'<path d="M6 8.5h12l1 11.5H5z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/><path d="M9 13h6"/>',
'skill-search':'<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
'skill-crafting':'<path d="M14.5 4.5a4.5 4.5 0 0 0-5.6 5.6L3.5 15.5 6 18l5.4-5.4a4.5 4.5 0 0 0 5.6-5.6l-2.6 2.6-2.4-.6-.6-2.4z"/>',
# areas
'area-bunker':'<path d="M3 19h18"/><path d="M4.5 19v-5a7.5 7.5 0 0 1 15 0v5"/><path d="M9.5 19v-4h5v4"/><path d="M8 11.5h.01M16 11.5h.01" stroke-width="2.4"/>',
'area-archipelago':'<path d="M2.5 17c2 1.2 3.5 1.2 5 0s3-1.2 5 0 3.5 1.2 5 0 2.5-1.2 4 0"/><path d="M5 14c1.5-3 4.5-4.5 7-4.5s5.5 1.5 7 4.5"/><path d="M12 9.5V4l4 1.8L12 7.5"/>',
'area-town':'<path d="M3 20h18"/><path d="M4.5 20v-8l4-3.5 4 3.5v8"/><path d="M12.5 20v-11l3.5-3 3.5 3v11"/><path d="M7.5 15h2M15 12h2M15 16h2"/>',
# states
'lock':'<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2.5"/>',
'unlock':'<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/><path d="M12 14.5v2.5"/>',
'check':'<path d="M5 12.5 10 17.5 19 7"/>',
'warning':'<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17h.01"/>',
'skull':'<path d="M6 16.5v-6a6 6 0 0 1 12 0v6h-2.5v3h-7v-3z"/><circle cx="9.5" cy="11.5" r="1.4" fill="currentColor"/><circle cx="14.5" cy="11.5" r="1.4" fill="currentColor"/>',
'star':'<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
'threat':'<path d="M12 4 18 12l-6 8-6-8z"/>',
'route':'<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17c5-1 2-8 6-9.5 2-.7 3.5-.5 4-.5" stroke-dasharray="2 2"/>',
'restart':'<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/>',
'swap':'<path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/>',
'aim':'<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
'info':'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5h.01"/>',
# v1.50 additions (full emoji replacement)
'arrow-right':'<path d="M4.5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
'chevron-right':'<path d="M9 5l7 7-7 7"/>',
'chevron-up':'<path d="M5 15.5 12 8.5l7 7"/>',
'chevron-down':'<path d="M5 8.5 12 15.5l7-7"/>',
'chevron-left':'<path d="M15 5 8 12l7 7"/>',
'dot':'<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>',
'player':'<path d="M12 4 18.5 19 12 15.5 5.5 19z" fill="'+A+'" fill-opacity=".25"/>',
'bit-face':'<circle cx="12" cy="12" r="8.5"/><path d="M9 10.5h.01M15 10.5h.01" stroke-width="2.6"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/>',
'sparkle':'<path d="M12 3c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7-.8-4.6-2.4-6.2-7-7 4.6-.8 6.2-2.4 7-7z"/><path d="M18.5 16.5v3M17 18h3" stroke="'+A+'"/>',
'flag':'<path d="M5.5 21V4"/><path d="M5.5 4.5h12l-2.5 4 2.5 4h-12"/><path d="M9.5 4.5v8M13.5 4.5v8" opacity=".45"/>',
'target':'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="'+A+'" stroke="none"/>',
'build':'<path d="M14.5 4.5 19.5 9.5l-2 2-5-5z"/><path d="M13.5 8.5 4.5 17.5a1.4 1.4 0 0 0 2 2l9-9"/><path d="M17 4.5l2.5-1M19.5 7l1-2.5" stroke="'+A+'"/>',
'timer':'<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9" stroke="'+A+'"/><path d="M12 13l2.5 2"/><path d="M10 3.5h4M12 3.5v2"/>',
'generator':'<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M7.5 7V5h3v2M13.5 7V5h3v2"/><path d="M12.5 9.5 10 13.5h3l-1.5 3.5" stroke="'+A+'"/>',
'scavenge':'<path d="M4 18.5h16"/><path d="M6.5 18.5 9 9.5h6l2.5 9"/><path d="M10 9.5V6.5a2 2 0 0 1 4 0v3"/><circle cx="17.5" cy="6" r="2" stroke="'+A+'"/><path d="M19 7.5l1.5 1.5" stroke="'+A+'"/>',
'scaffold':'<path d="M5 20V4M19 20V4M5 8h14M5 14h14"/><path d="M5 8l14 6M19 8 5 14" opacity=".55"/><circle cx="12" cy="4" r="1.3" fill="'+A+'" stroke="none"/>',
'play':'<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z" fill="'+A+'" fill-opacity=".35"/>',
'phone-rotate':'<rect x="7.5" y="3" width="9" height="16" rx="2" transform="rotate(-90 12 12)"/><path d="M4 7.5A8.5 8.5 0 0 1 10 3.6M10 3.6 8.4 2M10 3.6 8.6 5.4" stroke="'+A+'"/><path d="M11 15.5h2"/>',
'reset':'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4h4"/>',
'dev':'<path d="M8 8 4 12l4 4M16 8l4 4-4 4M13.5 5.5l-3 13"/>',
'hit':'<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/>',
'track-on':'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6" fill="'+A+'" stroke="none"/>',
'track-off':'<circle cx="12" cy="12" r="8"/>',
'dash':'<path d="M6 18 18 6M9 6h9v9"/><path d="M3.5 14.5l3-3M9.5 20.5l3-3" opacity=".5"/>',
'route-left':'<path d="M18 6 6 18M6 9v9h9"/>',
'route-right':'<path d="M6 18 18 6M9 6h9v9"/>',
'hazard':'<path d="M13 2.5 5.5 13.5h5.5L10 21.5l8.5-11.5H13z" fill="'+A+'" fill-opacity=".2"/>',
'pickup':'<path d="M12 4 18 12l-6 8-6-8z" fill="'+A+'" fill-opacity=".3"/>',
'plus':'<path d="M12 5v14M5 12h14"/>',
'bar':'<rect x="8" y="4" width="8" height="16" rx="1.5" fill="currentColor" stroke="none"/>',
'power':'<path d="M12 3v8"/><path d="M7 6.2a7.5 7.5 0 1 0 10 0"/>',
'infinity':'<path d="M12 12c-2-3-3.5-4-5.2-4a4 4 0 0 0 0 8c1.7 0 3.2-1 5.2-4s3.5-4 5.2-4a4 4 0 0 1 0 8c-1.7 0-3.2-1-5.2-4z"/>',
}
# v1.51 item icons, art direction ad06: one bespoke icon per item in data/items.js.
# Rules: big readable silhouette (works at physical mobile size, no close-up detail), stroke = currentColor
# (neutral / rarity colour), ONE amber loot accent (AD: amber = loot, reward) via var(--ic-loot).
L='var(--ic-loot,#FF9D4D)'
ITEMS={
'item-powercell':'<rect x="6.5" y="5" width="11" height="15.5" rx="2.2"/><path d="M10 2.8h4"/><path d="M13 8.2 10.2 13h3.6L11 17.8" stroke="'+L+'"/>',
'item-cable':'<path d="M5 3.5v5a3 3 0 0 0 3 3h8a3 3 0 0 1 3 3v6"/><rect x="3" y="2.5" width="4" height="3" rx=".8" stroke="'+L+'"/><path d="M17.5 20.5h3"/>',
'item-fuse':'<rect x="6" y="7.5" width="12" height="9" rx="2"/><path d="M3 12h3M18 12h3"/><path d="M9.5 12h5" stroke="'+L+'"/>',
'item-relay':'<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M7.5 18v2.5M16.5 18v2.5"/><path d="M13 8.5 10 12.5h4l-3 4" stroke="'+L+'"/>',
'item-alloy':'<path d="M3.5 16 8 9h12.5L16 16z"/><path d="M3.5 16v3h12.5l4.5-7V9"/><path d="M9.5 12.5h5" stroke="'+L+'"/>',
'item-servo':'<rect x="3.5" y="8" width="11" height="9" rx="1.6"/><circle cx="17.5" cy="12.5" r="3.5"/><circle cx="17.5" cy="12.5" r="1" fill="'+L+'" stroke="'+L+'"/><path d="M6.5 8V6h5v2"/>',
'item-plate':'<path d="M5 4.5h14l1.5 3v9L19 19.5H5l-1.5-3v-9z"/><circle cx="7" cy="7.5" r=".6" fill="currentColor"/><circle cx="17" cy="16.5" r=".6" fill="currentColor"/><path d="M8.5 12h7" stroke="'+L+'"/>',
'item-hydraulic':'<rect x="3" y="9" width="11" height="6" rx="1.4"/><path d="M14 12h7M21 9.5v5"/><path d="M6.5 9V6.5h4V9"/><path d="M6 12h5" stroke="'+L+'"/>',
'item-circuit':'<rect x="4.5" y="4.5" width="15" height="15" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8" stroke="'+L+'"/><path d="M12 4.5v5M4.5 12h5M14.5 12h5M12 14.5v5"/>',
'item-sensor':'<rect x="3.5" y="7" width="12" height="10" rx="2"/><path d="M15.5 9.5 20.5 7v10l-5-2.5"/><circle cx="9.5" cy="12" r="2.4" stroke="'+L+'"/>',
'item-memory':'<rect x="3" y="7.5" width="18" height="8" rx="1.2"/><path d="M6 15.5v2.5M10 15.5v2.5M14 15.5v2.5M18 15.5v2.5"/><path d="M7 11.5h10" stroke="'+L+'"/>',
'item-transmitter':'<rect x="7" y="10" width="10" height="10.5" rx="1.8"/><path d="M12 10V4"/><path d="M7.8 3.8a6 6 0 0 0 0 5.4M16.2 3.8a6 6 0 0 1 0 5.4" stroke="'+L+'"/><path d="M9.5 16.5h5"/>',
'item-medgel':'<path d="M8 3.5h8M9 3.5v3.5c-2.5 1-4 3.5-4 6.5a7 7 0 0 0 14 0c0-3-1.5-5.5-4-6.5V3.5"/><path d="M12 11v6M9 14h6" stroke="'+L+'"/>',
'item-bio':'<path d="M9.5 3.5h5M10.5 3.5v6L5.5 18a1.8 1.8 0 0 0 1.6 2.5h9.8a1.8 1.8 0 0 0 1.6-2.5l-5-8.5v-6"/><path d="M7.5 15.5h9" stroke="'+L+'"/>',
'item-filter':'<path d="M4 4.5h16l-6 7.5v6.5l-4 2v-8.5z"/><path d="M8 8.5h8" stroke="'+L+'"/>',
'item-drive':'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 14.5h16"/><circle cx="16.5" cy="17" r=".6" fill="currentColor"/><rect x="9.5" y="8.5" width="5" height="3.5" rx=".6" stroke="'+L+'"/><path d="M10.5 8.5V7.5a1.5 1.5 0 0 1 3 0v1" stroke="'+L+'"/>',
'item-ai':'<path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8z"/><path d="M12 8.5v3.5l3 2M12 12l-3 2" stroke="'+L+'"/><circle cx="12" cy="8.5" r=".9" fill="'+L+'" stroke="none"/>',
'item-shard':'<path d="M12 2.5 17 9l-2.5 12.5h-5L7 9z"/><path d="M7 9h10M12 2.5v19" opacity=".45"/><path d="M10 13.5l2 2 2-2" stroke="'+L+'"/>',
'item-neuralcore':'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3" stroke="'+L+'"/><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5"/>',
'item-chart':'<path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M7.5 13c1.5-2.5 3-1 4.5-3s2.5-1 4-2" stroke="'+L+'" stroke-dasharray="1.6 1.6"/><path d="M15.5 13.5l2 2M17.5 13.5l-2 2" stroke="'+L+'"/>',
'item-survey':'<rect x="5" y="3.5" width="14" height="17" rx="1.8"/><path d="M9 3.5V5.5h6V3.5"/><path d="M7.5 18l3-5 2.5 2.5 3.5-6" stroke="'+L+'"/><path d="M8 9h4"/>',
'item-relic':'<path d="M7 20.5h10M9 20.5V17h6v3.5"/><path d="M8 17c-2-2-3-4.5-3-7a7 7 0 0 1 14 0c0 2.5-1 5-3 7"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0" stroke="'+L+'"/>',
'item-carbine':'<path d="M2.5 10.5h14l1.5-1.5h3.5v3.5H18l-1 1H9.5l-1.5 4.5H5l1-4.5H2.5z"/><path d="M11.5 13v1.8" stroke="'+L+'"/>',
'item-smg':'<path d="M4 9h11l1.5-1.5H20v3h-3l-1 1h-3l-1.5 6H9l1-6H4z"/><path d="M13 11.5l-.6 3" stroke="'+L+'"/>',
'item-rifle':'<path d="M2 12h16l1.5-1h2.5v2.5h-3l-2 1H9.5l-1 3.5H5.5l.7-3.5H2z"/><rect x="9" y="7" width="6" height="2.6" rx="1.3" stroke="'+L+'"/>',
'item-shotgun':'<path d="M2.5 10.5h15l4 1v2l-4 1H10l-1.5 4H5.5l1-4H2.5z"/><path d="M11.5 12.5h4.5" stroke="'+L+'"/>',
'item-vest':'<path d="M8 3.5 5 6v14h5.5v-5h3v5H19V6l-3-2.5-1.5 3h-5z"/><path d="M8 11h2.5M13.5 11H16" stroke="'+L+'"/>',
'item-rig':'<path d="M7 3.5v17M17 3.5v17"/><path d="M7 8.5h10M7 15h10"/><rect x="9" y="10" width="6" height="3.5" rx=".8" stroke="'+L+'"/>',
'item-cloak':'<path d="M12 3a4 4 0 0 0-4 4v1.5L4.5 20.5h15L16 8.5V7a4 4 0 0 0-4-4z"/><path d="M10 7.5h4" stroke="'+L+'"/><path d="M9 14c1 .8 2 .8 3 0s2-.8 3 0" opacity=".55"/>',
'item-medkit':'<rect x="3.5" y="6.5" width="17" height="13" rx="2.5"/><path d="M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5"/><path d="M12 10v6M9 13h6" stroke="'+L+'"/>',
'item-crate':'<rect x="3.5" y="6" width="17" height="13" rx="1.5"/><path d="M3.5 10.5h17"/><path d="M10 10.5v2.5h4v-2.5" stroke="'+L+'"/>',
'item-datacore':'<path d="M12 3 19 12l-7 9-7-9z"/><path d="M8.8 12h6.4M12 7.5v9" stroke="'+L+'"/>',
'item-ammo':'<rect x="4" y="9.5" width="16" height="10" rx="1.6"/><path d="M7 9.5V5.5a1.2 1.2 0 0 1 2.4 0v4M10.8 9.5V5.5a1.2 1.2 0 0 1 2.4 0v4M14.6 9.5V5.5a1.2 1.2 0 0 1 2.4 0v4" stroke="'+L+'"/><path d="M4 13.5h16"/>',
}
I.update(ITEMS)
# v1.52 BIT icons: CRT body + the LOCKED face geometry (tools/bitface.py, AD ad06 p22-23). Never a generic smiley.
from bitface import face_svg_elems
C='var(--ic-accent,#3FE0D0)'
def _bit(face_w, bx, by, bw, bh):
    s=face_w/1000; fx=bx+(bw-face_w)/2; fy=by+(bh-875*s)/2+0.2
    body=f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="3.6"/>'
    return body+'<path d="M7.5 '+str(by)+'V3.2"/><circle cx="7.5" cy="2.6" r=".7" fill="currentColor" stroke="none"/><rect x="'+str(bx+bw)+'" y="'+str(by+4)+'" width="1.6" height="'+str(bh-8)+'" rx=".7"/><circle cx="'+str(bx+bw-2.2)+'" cy="'+str(by+2.1)+'" r=".55" fill="var(--ic-loot,#FF9D4D)" stroke="none"/>'+face_svg_elems(s,fx,fy,C)
I['nav-bit']=_bit(12.5,3,5.5,16.5,14)
I['bit-face']=_bit(13.5,2.5,5,17.5,15)

os.makedirs('assets/icons',exist_ok=True)
for k,v in I.items():
    open(f'assets/icons/{k}.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="pr-icon" aria-hidden="true">{v}</svg>\n')
# sprite for <use>
sym=''.join(f'<symbol id="{k}" viewBox="0 0 24 24">{v}</symbol>' for k,v in I.items())
open('assets/icons/sprite.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">{sym}</svg>\n')
json.dump(list(I),open('/tmp/icons.json','w'))
# nodspel is served on its own: ship the same sprite next to it
open('nodspel/ui-icons.svg','w').write(open('assets/icons/sprite.svg').read())
print(len(I))
