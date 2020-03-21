import { FunctionalComponent, h } from "preact";
import { CubeCanvas } from "./components/cube-canvas";

export const App: FunctionalComponent = () => {
    return (
        <div id="app">
            <h1>Hello WebGL</h1>
            <CubeCanvas />
        </div>
    );
};