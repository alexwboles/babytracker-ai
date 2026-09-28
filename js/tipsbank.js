/* BabyTracker AI — soothing-tips library. Gentle, practical, non-medical.
   Browser + Node (UMD). */
"use strict";

/* cat: feeding | sleep | fussy | diaper | general */
const TIPS = [
  { cat: "feeding", t: "Feed on early hunger cues (rooting, hand-sucking) — crying is a late cue and makes latching harder." },
  { cat: "feeding", t: "Keep a water bottle and snack where you nurse — hydration and calories matter for you too." },
  { cat: "feeding", t: "Burp midway and after feeds; a few gentle pats beat vigorous bouncing." },
  { cat: "feeding", t: "For bottle feeds, pace the bottle (hold it more horizontal) so baby controls the flow." },
  { cat: "feeding", t: "Track which side you last nursed on — future-you at 3 AM will be grateful." },
  { cat: "sleep", t: "Watch wake windows: newborns get sleepy after 45–90 minutes awake." },
  { cat: "sleep", t: "A dark room, white noise, and a consistent pre-nap routine are the whole magic trick." },
  { cat: "sleep", t: "Put baby down drowsy but awake when you can — it builds independent sleep skills." },
  { cat: "sleep", t: "Safe sleep: on their back, on a firm flat surface, with nothing else in the sleep space." },
  { cat: "sleep", t: "Daytime naps fuel nighttime sleep — an overtired baby sleeps worse, not better." },
  { cat: "fussy", t: "Try the 5 S's: swaddle, side/stomach hold (while awake), shush, swing, suck." },
  { cat: "fussy", t: "Change the scenery — step outside or into a different room. Novelty resets many meltdowns." },
  { cat: "fussy", t: "Skin-to-skin contact regulates baby's temperature, heart rate, and stress." },
  { cat: "fussy", t: "Check the basics in order: hungry, wet, gassy, tired, too hot/cold, overstimulated." },
  { cat: "fussy", t: "It's okay to put baby safely down and take five minutes. A regulated caregiver soothes faster." },
  { cat: "diaper", t: "Change diapers before or midway through night feeds to avoid fully waking baby after." },
  { cat: "diaper", t: "Newborns often go 8–12 diapers a day — stock more than you think you need." },
  { cat: "diaper", t: "Point it down (for boys) and make sure the leg cuffs are flared out to prevent leaks." },
  { cat: "diaper", t: "Air-dry time after wiping helps prevent diaper rash more than any cream." },
  { cat: "general", t: "You don't need to entertain a newborn — your face is their favorite show." },
  { cat: "general", t: "Accept help with chores and meals; visitors can hold the baby while you rest." },
  { cat: "general", t: "Tummy time starts small: a few minutes, a few times a day, building up gradually." },
  { cat: "general", t: "Trust your instincts and your pediatrician over the loudest voice online." },
  { cat: "general", t: "The days are long but the weeks fly — this phase is temporary, even the 3 AM one." }
];

const TIP_CATS = ["feeding", "sleep", "fussy", "diaper", "general"];

/** Tips for a category (or all when cat is null). */
function tipsFor(cat) {
  return cat ? TIPS.filter(t => t.cat === cat) : TIPS.slice();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TIPS, TIP_CATS, tipsFor };
}
