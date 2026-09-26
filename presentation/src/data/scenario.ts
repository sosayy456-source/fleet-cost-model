import scenario from './scenario.json';
export type ScenarioBill = (typeof scenario.bills)[number];
export default scenario;
