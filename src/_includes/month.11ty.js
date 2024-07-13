module.exports = class {
  data() {
    return {
      permalink: false, // This component should not create its own HTML file
    };
  }

  render(data) {
    const { year, month } = data; 
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
      calendarHTML += `<div class="month-day-container">${day}</div>`;
    }

    calendarHTML += "</div></div></div>";

    return calendarHTML;
  }
};
