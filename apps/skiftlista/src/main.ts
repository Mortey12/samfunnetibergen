import "@fontsource-variable/dm-sans"
import "@fontsource-variable/fraunces"
import "./styles.css"
import { mount } from "svelte"
import App from "./App.svelte"
import { createFakeApi } from "./core/fake"

const target = document.getElementById("root")
if (!target) throw new Error("Missing #root")

// The prototype always uses the fake. The real app picks the HTTP client
// here, from an environment flag, and never ships the fake to production.
mount(App, { target, props: { api: createFakeApi() } })
