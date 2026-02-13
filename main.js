fetch('data.json')
  .then(res => res.json())
  .then(data => {

    document.getElementById("total").innerText = data.total_responses;

    new Chart(document.getElementById("serviceChart"), {
      type: 'bar',
      data: {
        labels: Object.keys(data.top_service),
        datasets: [{
          label: "Service le plus interrompu",
          data: Object.values(data.top_service)
        }]
      }
    });

    new Chart(document.getElementById("provinceChart"), {
      type: 'bar',
      data: {
        labels: Object.keys(data.provinces_priority),
        datasets: [{
          label: "Provinces prioritaires",
          data: Object.values(data.provinces_priority)
        }]
      }
    });

  });
