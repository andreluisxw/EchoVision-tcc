// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import CoordinatePreview from './CoordinatePreview';
vi.mock('./LocationMiniMap',()=>({default:()=> <div>Mapa com marcador</div>}));
afterEach(()=>{cleanup();vi.useRealTimers();});
test('abre com foco e fecha com Escape',async()=>{
  render(<CoordinatePreview latitude={-23.55} longitude={-46.63}/>);
  expect(screen.queryByRole('region')).toBeNull();
  fireEvent.focus(screen.getByRole('button',{name:/Ver localização/}));
  expect(await screen.findByRole('region')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('button',{name:/Ver localização/}),{key:'Escape'});
  expect(screen.queryByRole('region')).toBeNull();
});
test('toque abre prévia com link para mapa centrado',async()=>{
  render(<CoordinatePreview latitude={-23.55} longitude={-46.63}/>);
  fireEvent.click(screen.getByRole('button',{name:/Ver localização/}));
  expect(await screen.findByRole('region')).toBeTruthy();
  expect(screen.getByRole('link',{name:'Abrir no mapa principal'}).getAttribute('href')).toBe('/?latitude=-23.55&longitude=-46.63');
});
test('hover aguarda brevemente antes de abrir',async()=>{
  vi.useFakeTimers();render(<CoordinatePreview latitude={-23.55} longitude={-46.63}/>);
  fireEvent.mouseEnter(screen.getByRole('button',{name:/Ver localização/}).parentElement!);
  expect(screen.queryByRole('region')).toBeNull();
  await act(async()=>{vi.advanceTimersByTime(250);});
  expect(screen.getByRole('region')).toBeTruthy();
});
