# App Store screenshots — IronMedic

Apple needs **portrait** iPhone shots (no status-bar secrets; no device frame required).

## Required sizes (upload the same shots scaled if needed)

| Display | Typical device | Size (px) |
|---------|----------------|-----------|
| 6.7"    | iPhone 15/16 Pro Max | **1290 × 2796** (or 1320 × 2868) |
| 6.1"    | iPhone 15/16 Pro     | **1179 × 2556** (or 1206 × 2622) |

You only need **3–5 strong shots** per size. Same creatives can be reused for both sizes (scale in Preview).

## Easiest: capture on your TestFlight iPhone

1. Open **IronMedic** on the phone.
2. Go to each screen below (use a clean chat / nice machine name if you can).
3. Screenshot: **Side button + Volume Up**.
4. In Photos → select shots → **Share → AirDrop** to this Mac.
5. Drop files into this folder, then upload in App Store Connect → App Store → iOS version → Screenshots.

### Shot list (recommended order)

1. **Home** — “What’s the machine doing?” + Ask Gus composer + Gus avatar  
2. **Active diagnosis** — Gus reply with Summary + **Next Step chips** (best “wow” shot)  
3. **Fleet** — a couple of machines listed  
4. **Account / Pricing** — Free vs Pro (optional but good for conversion)

Tips:
- Turn on **Do Not Disturb** so no notification banners appear.
- Prefer a real symptom (hydraulics / leak) so chips look useful.
- Avoid empty “New machine” placeholders if you can rename or use Deere/Cat sessions.

## Alternative: Xcode Simulator on your Mac

```bash
cd /Users/gideonosborn/IronMedic
npm run build:ios
npm run open:ios
```

In Xcode: pick **iPhone 16 Pro Max** → Run ▶  
Screenshot: **Cmd + S** (saved to Desktop).  
Repeat with **iPhone 16 Pro** for 6.1".

## App Store Connect

App Store → your **1.0** version → **Screenshots**  
- Drag 6.7" shots into the 6.7" slot  
- Drag 6.1" shots into the 6.1" slot  

Then continue **Add for Review**.
