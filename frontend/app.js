const endpoint =
  "https://twjatftjowetvncxpfiy.supabase.co/functions/v1/usd-all";

const rateValue = document.querySelector("#rate-value");
const rateMeta = document.querySelector("#rate-meta");
const retrieved = document.querySelector("#retrieved");
const error = document.querySelector("#error");
const refresh = document.querySelector("#refresh");

function formatRate(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function loadRate() {
  refresh.disabled = true;
  error.hidden = true;
  rateMeta.textContent = "Fetching the latest rate";

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`Request failed with ${response.status}`);

    const data = await response.json();
    const baseCurrency = data.baseCurrency ?? data.base;
    const quoteCurrency = data.quoteCurrency ?? data.quote;
    const quotePerBase = data.quotePerBase ?? data.rate;
    const retrievedAt = data.retrievedAt ?? data.fetchedAt;

    if (!baseCurrency || !quoteCurrency || !Number.isFinite(quotePerBase)) {
      throw new Error("The response did not contain a valid exchange rate");
    }

    rateValue.textContent = `${formatRate(quotePerBase)} ${quoteCurrency}`;
    rateMeta.textContent = data.stale
      ? "Using the latest saved rate"
      : `1 ${baseCurrency} equals`;
    retrieved.textContent = retrievedAt
      ? `Retrieved ${formatTime(retrievedAt)}`
      : "";
  } catch (requestError) {
    rateValue.textContent = "Unavailable";
    rateMeta.textContent = "The rate could not be loaded";
    error.textContent = requestError.message;
    error.hidden = false;
    retrieved.textContent = "";
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener("click", loadRate);
loadRate();
