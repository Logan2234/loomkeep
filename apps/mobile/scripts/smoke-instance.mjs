// The instance picker (MOB-15), driven like a user would: an address that
// isn't a Loomkeep instance is refused, loomkeep.app is accepted and the
// app restarts on it (smoke-check.mjs then checks it's back).
import { onPage } from "./devtools.mjs";

const submit = (address) => `(() => {
  document.getElementById("address").value = ${JSON.stringify(address)};
  document.getElementById("form").requestSubmit();
})()`;

await onPage(
  "loomkeep.app/login",
  `void window.Capacitor.registerPlugin("ShellInstance").open()`,
);
await onPage("instance.html", submit("docs.loomkeep.app"));

const refusal = await onPage(
  "error=not-loomkeep",
  `document.getElementById("error").textContent`,
);
if (!refusal)
  throw new Error("The picker didn't say why it refused the address");
console.log("The picker refused docs.loomkeep.app");

await onPage("instance.html", submit("loomkeep.app"));
