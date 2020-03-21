import 'ts-polyfill/lib/es2017-object';
import 'ts-polyfill/lib/es2016-array-include';
import 'regenerator-runtime/runtime';
import { render, h } from "preact";
import { App } from './app';

render(<App />, document.body);
