const Month = require("./month.11ty.js");

module.exports = class {
  data() {
    return {
      permalink: false, // This component should not create its own HTML file
    };
  }

  render(data) {
    const currentYear = data.year || new Date().getFullYear();
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
    const years = Array.from({ length: 7 }, (_, i) => currentYear - i);

    // Generate the HTML for all years
    const allYearsHTML = years.map(year => {
      const monthsHtml = monthNames.map((_, index) => {
        const month = new Month();
        return month.render({ year, month: index, collection: curations });
      }).join('');

      return `
        <div class="year-container" data-year="${year}" style="${year === currentYear ? '' : 'display: none;'}">
          <h2 class="center-text">${year}</h2>
          <div class="calendar-grid">
            ${monthsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="calendar-controls">
        <select id="yearSelect">
          ${years.map(
            y => `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`
          ).join('')}
        </select>
        <div class="calendar-hint">
          <p>💡 Click on any highlighted date to view that day's word curation</p>
        </div>
      </div>
      ${allYearsHTML}
      <script>
        document.getElementById('yearSelect').addEventListener('change', function() {
          const selectedYear = this.value;
          document.querySelectorAll('.year-container').forEach(container => {
            container.style.display = container.getAttribute('data-year') === selectedYear ? '' : 'none';
          });
        });
      </script>
    `;
  }
};
