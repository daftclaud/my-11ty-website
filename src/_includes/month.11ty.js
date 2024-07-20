module.exports = class {
  data() {
    return {
      permalink: false, // This component should not create its own HTML file
    };
  }

  render(data) {
    const { year, month, collection } = data;
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

    const availableDates = collection.map(item => item.fileSlug);

    const getPaddedDate = (year, month, day) => {
      const paddedMonth = month.toString().padStart(2, "0");
      const paddedDay = day.toString().padStart(2, "0");
      return `${year}-${paddedMonth}-${paddedDay}`;
    };

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let calendarHTML = `<div class="month">
                            <div class="month-title">${monthNames[month]}</div>
                            <div class="month-body">
                              <div class="month-week">`;

    // Add empty cells for days of the week before the 1st
    for (let i = 0; i < firstDay; i++) {
      calendarHTML += '<div class="month-blank-day-container"></div>';
    }

    // Add cells for each day of the month
    for (let day = 1; day <= lastDate; day++) {
      if ((firstDay + day - 1) % 7 === 0 && day !== 1) {
        calendarHTML += "</div><div class='month-week'>";
      }

      if (availableDates.includes(getPaddedDate(year, month + 1, day))) {
        calendarHTML += `
          <div class="month-day-container active">
            <a href="/word-curations/${getPaddedDate(year, month + 1, day)}">${day}</a>
          </div>
        `;
      } else {
        calendarHTML += `
          <div class="month-day-container">
            ${day}
          </div>
        `;
      }
    }

    calendarHTML += "</div></div></div>";

    return calendarHTML;
  }
};
