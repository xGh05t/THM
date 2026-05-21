const probeForm = document.getElementById("probeForm");
const resetButton = document.getElementById("resetButton");
const predictionValue = document.getElementById("predictionValue");
const riskBandValue = document.getElementById("riskBandValue");
const apiError = document.getElementById("apiError");

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function setError(message) {
  apiError.textContent = message;
  apiError.classList.remove("hidden");
}

function clearError() {
  apiError.textContent = "";
  apiError.classList.add("hidden");
}

probeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const payload = {
    features: [
      Number(document.getElementById("feature1").value),
      Number(document.getElementById("feature2").value),
      Number(document.getElementById("feature3").value),
      Number(document.getElementById("feature4").value),
      Number(document.getElementById("feature5").value),
      Number(document.getElementById("feature6").value),
    ],
  };

  try {
    const data = await requestJson("/predict", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    predictionValue.textContent = data.classification;
    riskBandValue.textContent = data.risk_band;
  } catch (error) {
    setError(error.message);
  }
});

resetButton.addEventListener("click", async () => {
  clearError();

  await requestJson("/reset", {
    method: "POST",
    body: JSON.stringify({}),
  });

  predictionValue.textContent = "awaiting query";
  riskBandValue.textContent = "-";
});
