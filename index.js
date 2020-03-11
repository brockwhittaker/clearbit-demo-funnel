import Funnel from './Funnel.js';
import sample_data from './sample-data.js';

const funnel = new Funnel(document.querySelector("svg"));

funnel.dimensions(2.5, 1);
funnel.data(sample_data);
funnel.draw();
