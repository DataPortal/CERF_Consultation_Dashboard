fetch('data.json')
  .then(res => res.json())
  .then(data => {

    document.getElementById("total").innerText = data.total_responses;

    function createChart(id, dataset, label) {
      if (Object.keys(dataset).length === 0) return;

      new Chart(document.getElementById(id), {
        type: 'bar',
        data: {
          labels: Object.keys(dataset),
          datasets: [{
            label: label,
            data: Object.values(dataset)
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    createChart("serviceChart", data.top_service, "Service SSR Prioritaire");
    createChart("graviteChart", data.gravite, "Gravité des ruptures");
    createChart("provinceChart", data.provinces, "Provinces prioritaires");
    createChart("groupChart", data.groupes, "Groupes sous-desservis");
    createChart("riskChart", data.risques, "Risques opérationnels");
    createChart("digitalChart", data.digital, "Avantages Digital");

  });
