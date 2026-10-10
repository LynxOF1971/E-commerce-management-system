import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig(({command}) => {
  if(command==='build'&&!process.env.VITE_GOOGLE_SCRIPT_URL)throw Error('VITE_GOOGLE_SCRIPT_URL must point to the deployed Google Apps Script URL.');
  return {
  root: resolve(import.meta.dirname),
  base: '/E-commerce-management-system/',
  publicDir: resolve(import.meta.dirname, '../public'),
  plugins: [react()],
  build: {outDir: '../dist-pages', emptyOutDir: true},
  resolve: {alias: {'@': resolve(import.meta.dirname, '..')}},
};
});
