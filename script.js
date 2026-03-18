
const state = {
  selectedDate: getEffectiveTurnDateNow(),
  geo: {
    latitude: null,
    longitude: null,
    status: "idle",
    errorMessage: null,
  },
};

const dom = {
  dateLabel: document.getElementById("dateLabel"),
  selectedDateText: document.getElementById("selectedDateText"),
  turnBadge: document.getElementById("turnBadge"),
  dateInput: document.getElementById("dateInput"),
  openDateButton: document.getElementById("openDateButton"),
  todayButton: document.getElementById("todayButton"),
  retryLocationButton: document.getElementById("retryLocationButton"),
  toggleDarkButton: document.getElementById("toggleDarkButton"),
  locationBanner: document.getElementById("locationBanner"),
  locationBannerContent: document.getElementById("locationBannerContent"),
  turnValidityText: document.getElementById("turnValidityText"),
  turnSectionTitle: document.getElementById("turnSectionTitle"),
  turnSection: document.getElementById("turnSection"),
  mainFeatureTitle: document.getElementById("mainFeatureTitle"),
  mainPharmacy: document.getElementById("mainPharmacy"),
  moreTurnPharmacies: document.getElementById("moreTurnPharmacies"),
  emptyState: document.getElementById("emptyState"),
  viewAllButton: document.getElementById("viewAllButton"),
  allPharmaciesModal: document.getElementById("allPharmaciesModal"),
  allPharmaciesSubtitle: document.getElementById("allPharmaciesSubtitle"),
  allPharmaciesList: document.getElementById("allPharmaciesList"),
  closeModalButton: document.getElementById("closeModalButton"),
};

document.addEventListener("DOMContentLoaded", init);

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("farmacias-theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  } else if (savedTheme === "light") {
    document.body.classList.remove("dark");
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }
  updateThemeButton();
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("farmacias-theme", document.body.classList.contains("dark") ? "dark" : "light");
  updateThemeButton();
}

function updateThemeButton() {
  if (!dom.toggleDarkButton) return;
  dom.toggleDarkButton.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

function init() {
  initTheme();
  dom.dateInput.value = formatDateForInput(state.selectedDate);
  bindEvents();
  requestLocation(true);
  render();
}

function bindEvents() {
  dom.openDateButton.addEventListener("click", openDatePicker);
  dom.toggleDarkButton?.addEventListener("click", toggleTheme);

  dom.dateInput.addEventListener("change", (event) => {
    if (!event.target.value) return;
    state.selectedDate = parseInputDate(event.target.value);
    dom.dateInput.blur();
    render();
  });

  dom.todayButton.addEventListener("click", () => {
    state.selectedDate = getEffectiveTurnDateNow();
    dom.dateInput.value = formatDateForInput(state.selectedDate);
    render();
  });

  dom.retryLocationButton.addEventListener("click", () => requestLocation(false));
  dom.viewAllButton.addEventListener("click", openAllPharmaciesModal);
  dom.closeModalButton.addEventListener("click", closeAllPharmaciesModal);

  dom.allPharmaciesModal.addEventListener("click", (event) => {
    if (event.target === dom.allPharmaciesModal) {
      closeAllPharmaciesModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllPharmaciesModal();
    }
  });
}

function render() {
  const effectiveNow = getEffectiveTurnDateNow();
  const activeTurnSelected = isSameDate(state.selectedDate, effectiveNow);
  const letraTurno = getLetraTurnoByDate(state.selectedDate);
  const distances = buildDistancesMap();
  const farmaciasTurno = letraTurno
    ? sortPharmacies(
        FARMACIAS.filter((item) => item.letraTurno === letraTurno),
        distances
      )
    : [];

  dom.dateInput.value = formatDateForInput(state.selectedDate);
  dom.dateLabel.textContent = activeTurnSelected ? "Turno vigente ahora" : "Fecha seleccionada";
  dom.selectedDateText.textContent = formatDateForDisplay(state.selectedDate);
  dom.turnBadge.textContent = letraTurno ? `Turno ${letraTurno}` : "Sin turno";
  dom.turnValidityText.textContent = formatTurnValidityText(state.selectedDate);
  dom.turnSectionTitle.textContent = activeTurnSelected ? "Farmacia de turno ahora" : "Farmacia de turno";
  dom.todayButton.classList.toggle("hidden", activeTurnSelected);
  dom.retryLocationButton.classList.toggle("hidden", state.geo.status === "granted" || state.geo.status === "loading");

  renderLocationBanner();
  renderTurnPharmacies(farmaciasTurno, distances);
  updateThemeButton();
  refreshIcons();
}

function renderLocationBanner() {
  const { status, errorMessage } = state.geo;

  if (status === "granted") {
    dom.locationBanner.classList.add("hidden");
    dom.locationBannerContent.innerHTML = "";
    return;
  }

  dom.locationBanner.classList.remove("hidden");

  if (status === "loading") {
    dom.locationBannerContent.innerHTML = `
      <div class="location-banner-row">
        <div class="location-banner-icon"><i data-lucide="locate-fixed"></i></div>
        <div class="location-banner-text">
          <p class="location-banner-title">Obteniendo tu ubicación…</p>
          <p class="location-banner-message">Estamos intentando ordenar las farmacias por cercanía.</p>
        </div>
      </div>
    `;
    return;
  }

  const message = errorMessage || "Activá tu ubicación para ordenar por cercanía.";
  dom.locationBannerContent.innerHTML = `
    <div class="location-banner-row">
      <div class="location-banner-icon"><i data-lucide="map-pin"></i></div>
      <div class="location-banner-text">
        <p class="location-banner-title">Ubicación no disponible</p>
        <p class="location-banner-message">${escapeHtml(message)}</p>
      </div>
      <button class="action-button primary location-banner-button" id="bannerRetryButton">Usar mi ubicación</button>
    </div>
  `;

  document.getElementById("bannerRetryButton")?.addEventListener("click", () => requestLocation(false));
}

function renderTurnPharmacies(farmaciasTurno, distances) {
  dom.mainPharmacy.innerHTML = "";
  dom.moreTurnPharmacies.innerHTML = "";
  if (dom.mainFeatureTitle) dom.mainFeatureTitle.innerHTML = "";

  if (!farmaciasTurno.length) {
    dom.turnSection.classList.add("hidden");
    dom.emptyState.classList.remove("hidden");
    return;
  }

  dom.turnSection.classList.remove("hidden");
  dom.emptyState.classList.add("hidden");

  if (dom.mainFeatureTitle) {
    dom.mainFeatureTitle.innerHTML = `<div class="main-feature-title"><span class="dot"></span>Farmacia de turno ahora</div>`;
  }

  const closestTurnoId = distances.size > 0 ? farmaciasTurno[0].id : null;
  dom.mainPharmacy.appendChild(
    createPharmacyCard(farmaciasTurno[0], {
      distance: distances.get(farmaciasTurno[0].id) ?? null,
      isClosest: farmaciasTurno[0].id === closestTurnoId,
      isHighlighted: true,
      showTurnBadge: false,
    })
  );

  if (farmaciasTurno.length > 1) {
    const heading = document.createElement("h3");
    heading.className = "subsection-title";
    heading.textContent = `También de turno (${farmaciasTurno.length - 1} más)`;
    dom.moreTurnPharmacies.appendChild(heading);

    farmaciasTurno.slice(1).forEach((farmacia) => {
      dom.moreTurnPharmacies.appendChild(
        createPharmacyCard(farmacia, {
          distance: distances.get(farmacia.id) ?? null,
          isClosest: false,
          isHighlighted: false,
          showTurnBadge: false,
        })
      );
    });
  }
}

function openAllPharmaciesModal() {
  const distances = buildDistancesMap();
  const allPharmacies = sortPharmacies(FARMACIAS, distances);
  const closestId = distances.size > 0 && allPharmacies.length ? allPharmacies[0].id : null;

  dom.allPharmaciesSubtitle.textContent = `${allPharmacies.length} farmacias en San Nicolás de los Arroyos`;
  dom.allPharmaciesList.innerHTML = "";

  allPharmacies.forEach((farmacia) => {
    dom.allPharmaciesList.appendChild(
      createPharmacyCard(farmacia, {
        distance: distances.get(farmacia.id) ?? null,
        isClosest: farmacia.id === closestId,
        isHighlighted: false,
        showTurnBadge: true,
      })
    );
  });

  dom.allPharmaciesModal.classList.remove("hidden");
  dom.allPharmaciesModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  refreshIcons();
}

function closeAllPharmaciesModal() {
  dom.allPharmaciesModal.classList.add("hidden");
  dom.allPharmaciesModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function createPharmacyCard(farmacia, options = {}) {
  const {
    distance = null,
    isClosest = false,
    isHighlighted = false,
    showTurnBadge = false,
  } = options;

  const card = document.createElement("article");
  card.className = `pharmacy-card${isHighlighted ? " highlight" : ""}`;

  const phoneButton = farmacia.telefono
    ? `<button class="btn call" type="button" data-action="call" data-phone="${escapeAttribute(farmacia.telefono)}"><i data-lucide="phone"></i>Llamar</button>`
    : `<button class="btn disabled" type="button" disabled><i data-lucide="phone-off"></i>Sin teléfono</button>`;

  card.innerHTML = `
    <div class="pharmacy-card-header">
      <div>
        <h3 class="pharmacy-name">${escapeHtml(farmacia.nombre)}</h3>
        <p class="pharmacy-address"><i data-lucide="map-pin"></i><span>${escapeHtml(farmacia.direccion)}</span></p>
      </div>
      <span class="turn-letter">${escapeHtml(farmacia.letraTurno)}</span>
    </div>

    <div class="badges-row">
      ${isClosest ? `<span class="badge closest"><i data-lucide="map-pin"></i>La más cercana a vos</span>` : ""}
      ${distance != null ? `<span class="badge distance"><i data-lucide="navigation"></i>${formatDistance(distance)}</span>` : ""}
      ${showTurnBadge ? `<span class="badge turn">Turno ${escapeHtml(farmacia.letraTurno)}</span>` : ""}
    </div>

    <div class="actions-row">
      ${phoneButton}
      <button class="btn route" type="button" data-action="route" data-url="${escapeAttribute(farmacia.mapsUrl)}"><i data-lucide="navigation"></i>Cómo llegar</button>
      <button class="btn share" type="button" aria-label="Compartir" data-action="share" data-id="${farmacia.id}"><i data-lucide="share-2"></i></button>
    </div>
  `;

  card.querySelector('[data-action="call"]')?.addEventListener("click", () => {
    window.location.href = `tel:${farmacia.telefono}`;
  });

  card.querySelector('[data-action="route"]')?.addEventListener("click", () => {
    if (farmacia.mapsUrl) {
      window.open(farmacia.mapsUrl, "_blank", "noopener");
    }
  });

  card.querySelector('[data-action="share"]')?.addEventListener("click", async () => {
    await sharePharmacy(farmacia);
  });

  return card;
}

async function sharePharmacy(farmacia) {
  const text = `Farmacia ${farmacia.nombre} - ${farmacia.direccion}${farmacia.telefono ? ` - Tel: ${farmacia.telefono}` : ""}`;
  const payload = {
    title: `Farmacia ${farmacia.nombre}`,
    text,
    url: farmacia.mapsUrl || window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(payload);
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}${farmacia.mapsUrl ? ` - ${farmacia.mapsUrl}` : ""}`);
    alert("Se copió la información de la farmacia al portapapeles.");
  } catch {
    alert(text);
  }
}

function openDatePicker() {
  const input = dom.dateInput;
  if (!input) return;

  input.value = formatDateForInput(state.selectedDate);

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch (error) {}
  }

  input.focus({ preventScroll: true });
  input.click();
}

function requestLocation(initialLoad = false) {
  if (!navigator.geolocation) {
    state.geo = {
      latitude: null,
      longitude: null,
      status: "unavailable",
      errorMessage: "Tu navegador no soporta geolocalización.",
    };
    render();
    return;
  }

  state.geo = {
    latitude: state.geo.latitude,
    longitude: state.geo.longitude,
    status: "loading",
    errorMessage: null,
  };
  render();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.geo = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        status: "granted",
        errorMessage: null,
      };
      render();
    },
    (error) => {
      let msg = "No pudimos acceder a tu ubicación.";
      let status = "error";

      if (error.code === error.PERMISSION_DENIED) {
        msg = initialLoad
          ? "No se pudo acceder a tu ubicación. Igual podés consultar la farmacia de turno o volver a intentarlo."
          : "No se pudo acceder a tu ubicación. Podés activarla desde los ajustes del navegador.";
        status = "denied";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = "Tu ubicación no está disponible en este momento.";
        status = "unavailable";
      } else if (error.code === error.TIMEOUT) {
        msg = "La solicitud de ubicación tardó demasiado.";
        status = "error";
      }

      state.geo = {
        latitude: null,
        longitude: null,
        status,
        errorMessage: msg,
      };
      render();
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    }
  );
}

function buildDistancesMap() {
  const map = new Map();
  if (state.geo.latitude == null || state.geo.longitude == null) return map;

  FARMACIAS.forEach((farmacia) => {
    map.set(
      farmacia.id,
      calculateDistance(
        state.geo.latitude,
        state.geo.longitude,
        farmacia.latitud,
        farmacia.longitud
      )
    );
  });

  return map;
}

function sortPharmacies(list, distances) {
  const copy = [...list];
  if (distances.size > 0) {
    copy.sort((a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity));
  } else {
    copy.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  return copy;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatTurnValidityText(date) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return `El turno tiene vigencia desde las 8:30 del ${formatDayMonth(date)} hasta las 08:30 del ${formatDayMonth(nextDay)}.`;
}

function formatDayMonth(date) {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[date.getDay()]} ${date.getDate()} de ${meses[date.getMonth()]}`;
}

function formatDateForDisplay(date) {
  const text = formatDayMonth(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateForInput(date) {
  return getLocalDateKey(date);
}

function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getEffectiveTurnDateNow() {
  return getEffectiveTurnDate(new Date());
}

function getEffectiveTurnDate(referenceDate) {
  const date = new Date(referenceDate);
  const effective = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (isBeforeTurnChange(referenceDate)) {
    effective.setDate(effective.getDate() - 1);
  }

  return effective;
}

function isBeforeTurnChange(referenceDate) {
  const hours = referenceDate.getHours();
  const minutes = referenceDate.getMinutes();
  return hours < 8 || (hours === 8 && minutes < 30);
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
