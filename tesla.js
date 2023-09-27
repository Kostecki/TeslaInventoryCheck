/*
https://www.tesla.com/da_DK/inventory/new/my?TRIM=LRAWD&PAINT=BLACK,BLUE&INTERIOR=PREMIUM_BLACK&WHEELS=NINETEEN&ADL_OPTS=TOWING&arrangeby=relevance&zip=8930&range=0
*/

require("dotenv").config();

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require("node-localstorage").LocalStorage;
  localStorage = new LocalStorage("./storage");
}

const query = {
  query: {
    model: "my",
    condition: "new",
    options: {
      TRIM: ["LRAWD"],
      PAINT: ["BLACK", "BLUE", "SILVER", "RED"],
      INTERIOR: ["PREMIUM_BLACK"],
      WHEELS: ["NINETEEN"],
      ADL_OPTS: ["TOWING"],
    },
    arrangeby: "Relevance",
    order: "desc",
    market: "DK",
    language: "da",
    super_region: "north america",
    lng: parseFloat(process.env.LNG),
    lat: parseFloat(process.env.LAT),
    zip: "8930",
    range: 0,
    region: "DK",
  },
  offset: 0,
  count: 50,
  outsideOffset: 0,
  outsideSearch: false,
};

const colorToEmoji = (paint) => {
  const color = paint[0].toLowerCase();

  switch (color) {
    case "black":
      return "⚫️ ";
    case "blue":
      return "🔵 ";
    case "silver":
    default:
      return "";
  }
};

const isGerman = (VIN) => {
  return VIN.startsWith("X7P");
};

const buildMessage = (year, trimName, color, price, totalPrice, paint) => {
  const discountPrice = price.toLocaleString("da-DK", {
    style: "currency",
    currency: "DKK",
  });
  const basePrice = totalPrice.toLocaleString("da-DK", {
    style: "currency",
    currency: "DKK",
  });

  return `${year} ${trimName}
Farve: ${colorToEmoji(paint)}${color}

Rabatpris: ${discountPrice}
Basispris: ${basePrice}`;
};

const sendNotification = (cars) => {
  if (cars.length) {
    cars.forEach(async (car) => {
      const {
        query: {
          zip,
          lat,
          lng,
          options: { TRIM, PAINT: paintQuery, INTERIOR, WHEELS, ADL_OPTS },
          range,
        },
      } = query;
      const { Year, TrimName, Price, TotalPrice, OptionCodeData, VIN, PAINT } =
        car;
      const color = OptionCodeData.find((o) => o.group === "PAINT").long_name;

      const actionLink = `https://www.tesla.com/da_DK/my/order/${VIN}?postal=${zip}&region=DK&coord=${lat},${lng}&titleStatus=new&redirect=no#overview`;
      const searchLink = `https://www.tesla.com/da_DK/inventory/new/my?TRIM=${
        TRIM[0]
      }&PAINT=${paintQuery.join(",")}&INTERIOR=${INTERIOR[0]}&WHEELS=${
        WHEELS[0]
      }&ADL_OPTS=${ADL_OPTS[0]}&arrangeby=relevance&zip=${zip}&range=${range}`;

      await fetch(`${process.env.NTFY_URL}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NTFY_TOKEN}`,
        },
        body: JSON.stringify({
          topic: "Tesla",
          title: "Ny bil på lager! 🚙💨",
          message: buildMessage(
            Year,
            TrimName,
            color,
            Price,
            TotalPrice,
            PAINT
          ),
          actions: [
            { action: "view", label: "Se bil", url: actionLink },
            { action: "view", label: "Se søgning", url: searchLink },
          ],
        }),
      });
    });
  }
};

const getInventory = async () => {
  const payload = encodeURIComponent(JSON.stringify(query));
  const url = `https://www.tesla.com/inventory/api/v1/inventory-results?query=${payload}`;
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
  };

  try {
    const response = await fetch(url, { headers });
    const inventory = await response.json();

    const results = inventory.results.exact ?? inventory.results;
    const newCars = [];

    if (results.length === 0) {
      localStorage.clear();
    }

    results.forEach(async (car) => {
      const { VIN } = car;
      const alreadyKnown = localStorage.getItem(VIN);

      if (!alreadyKnown && isGerman(VIN)) {
        localStorage.setItem(VIN, true);
        newCars.push(car);
      }
    });

    sendNotification(newCars);
  } catch (error) {
    console.error("Error", error.message);
  }
};

getInventory();
