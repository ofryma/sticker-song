/* The contact form. Its own module because the main dictionary is close to the
   300-line rule, the same way the admin strings were split out. */
export default {
  kicker: "Writing to us",
  title: "Say something",
  lead: "A suggestion, something broken, or a problem with a particular sticker. Someone reads everything that arrives here.",

  kindLabel: "What is this about",
  kind: {
    suggestion: "A suggestion",
    bug: "Something on the site is broken",
    entry_problem: "A problem with a sticker",
  },
  kindHint: {
    suggestion: "Something the archive could do, or do differently.",
    bug: "A page that will not load, a photo that will not open, anything that misbehaves.",
    entry_problem:
      "A name spelled wrong, a transcription that does not match, the wrong person, or a request to take a sticker down.",
  },

  aboutEntry: "About this sticker",
  aboutEntryMissing: "The sticker you came from could not be found. You can still write to us.",

  bodyLabel: "What you want to tell us",
  bodyPlaceholder: "Write it in your own words",
  bodyHint: "A sentence or two is enough. The more you can say, the easier it is to put right.",

  emailLabel: "Your email address",
  emailPlaceholder: "Optional",
  emailHint: "Only so we can write back. Nothing else is ever done with it.",

  send: "Send",
  sending: "Sending",

  thanksTitle: "Thank you",
  thanksLead:
    "It arrived, and someone will read it. If you left an address, we will write back once there is something to say.",
  thanksHome: "Back to the beginning",
  thanksWall: "The Wall",

  errorTitle: "The message did not go through",
  errorRetry: "Try sending again",

  required: {
    kind: "Choose what this is about.",
    body: "There is nothing written yet. A sentence or two is enough.",
    email: "That does not look like an email address. You can also leave it empty.",
  },
};
