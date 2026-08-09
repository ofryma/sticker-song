# Todo

## Observability

* Uptime check against `/healthz` with alerting — it exists and nothing calls it (ofry's comment - lets add uptime kuma)

## Bugs

All three fixed. Kept here as notes, because the first one can come back
anywhere a button sits under a field on a phone.

* ~~Can't send contact form — contact form cannot be sent at all~~ The tap was
  being lost, not the message. The on-screen keyboard closes as a thumb comes
  down on Send, the page reflows, the button slides out from under the finger,
  and no click is ever fired — silently. `hooks/useReliableTap.js` completes a
  tap that began on the button, and the reason a form will not send now stays on
  the page until it is met instead of clearing on the next keystroke.
* ~~Accessibility button hides some things in the site — should be draggable~~
  It drags anywhere in the window now and stays where it is put, per device
  (`hooks/useDraggable.js`).
* ~~Add-a-sticker in the phone nav should not always be green. Confusing~~ Every
  tab reads the same; olive is for what a visitor chose, and the active mark
  already says which page that is.
