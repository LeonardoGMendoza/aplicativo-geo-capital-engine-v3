import test from 'node:test'
import assert from 'node:assert/strict'
import { adicionarLugar, CHAVE_LUGARES, gravarLugares, lerLugares, MAX_LUGARES, migrarDeLocaisGuardados, paisDoEndereco, removerLugar } from '../src/features/lugares/meusLugares.ts'

const memoria = () => { const m = new Map(); return { m, setItem: (k, v) => m.set(k, v), getItem: k => m.get(k) ?? null } }

test('"Meus lugares": começa vazio, adiciona sem repetir e remove', () => {
  const a = memoria()
  assert.deepEqual(lerLugares(a), [])
  let lista = adicionarLugar([], { nome: 'Foz do Iguaçu', pais: 'Brasil', latitude: -25.54694, longitude: -54.58821 })
  lista = adicionarLugar(lista, { nome: 'Foz de novo', pais: 'Brasil', latitude: -25.55, longitude: -54.59 })
  assert.equal(lista.length, 1, 'mesmo ponto não repete')
  assert.equal(lista[0].latitude, -25.5469)
  lista = adicionarLugar(lista, { nome: 'Lima', pais: 'Peru', latitude: -12.05, longitude: -77.04 })
  assert.ok(gravarLugares(lista, a))
  assert.deepEqual(lerLugares(a).map(l => l.nome), ['Foz do Iguaçu', 'Lima'])
  assert.deepEqual(removerLugar(lista, lista[0].id).map(l => l.nome), ['Lima'])
  a.m.set(CHAVE_LUGARES, '[{"id":"x","nome":"ruim","latitude":999,"longitude":0}]')
  assert.deepEqual(lerLugares(a), [], 'ignora lixo')
})

test('limite de lugares e país pelo endereço', () => {
  let lista = []
  for (let i = 0; i < 20; i++) lista = adicionarLugar(lista, { nome: `L${i}`, pais: null, latitude: i, longitude: i })
  assert.equal(lista.length, MAX_LUGARES)
  assert.equal(paisDoEndereco('Salt Lake City, Salt Lake County, Utah, Estados Unidos'), 'EUA')
  assert.equal(paisDoEndereco('Foz do Iguaçu, Paraná, Região Sul, Brasil'), 'Brasil')
  assert.equal(paisDoEndereco(null), null)
})

test('quem já tinha cidades guardadas no Preparar ganha os mesmos lugares', () => {
  const guardados = {
    perto: { rotulo: 'Casa', origem: { latitude: -23.5, longitude: -46.4 } },
    tarapoto: { rotulo: 'Tarapoto, Peru', origem: { latitude: -6.4882, longitude: -76.361 } },
  }
  const lista = migrarDeLocaisGuardados([], guardados)
  assert.deepEqual(lista.map(l => [l.id, l.nome, l.pais]), [['tarapoto', 'Tarapoto', 'Peru']])
})
