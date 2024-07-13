const Month = require("./month.11ty.js");

module.exports = class {
  data() {
    return {
      permalink: false, // This component should not create its own HTML file
    };
  }

  render(data) {
    const year = data.year || new Date().getFullYear();
    const curations = data.collection || [];
    const monthNames = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];

    let gridHTML = `
    <h2 class="center-text">${year}</h2>
    <div class="calendar-grid">
      ${monthNames.map((_, index) => {
        const month = new Month();
        return month.render({ year, month: index, collection: curations });
      })}
    </div>
    `;

    return gridHTML;
  }
};
