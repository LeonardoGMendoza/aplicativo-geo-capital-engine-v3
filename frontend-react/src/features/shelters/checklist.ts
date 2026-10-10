export const checklistKey = 'omni-ecorescue-family-checklist-v1'
export const checklist = [
  ['water', 'Água potável: revisar a reserva conforme as necessidades da família'],
  ['food', 'Alimentos não perecíveis adequados à família'],
  ['opener', 'Abridor de latas manual'],
  ['first-aid', 'Kit de primeiros socorros'],
  ['medication', 'Medicamentos pessoais: revisar com orientação profissional'],
  ['masks', 'Máscaras de proteção'],
  ['documents', 'Documentos protegidos da água: RG, CPF e cartão SUS'],
  ['phone', 'Celular carregado e carregador portátil'],
  ['radio', 'Rádio a pilha e canais oficiais para acompanhar informações'],
  ['cash', 'Dinheiro em espécie conforme as possibilidades da família'],
  ['torch', 'Lanterna e pilhas reserva'],
  ['whistle', 'Apito para sinalização'],
  ['shoes', 'Calçado fechado e resistente'],
  ['blanket', 'Agasalho e cobertor'],
] as const
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export function readChecklist(storage: StorageAccess): string[] {
  try {
    const data: unknown = JSON.parse(storage.getItem(checklistKey) ?? '[]')
    if (!Array.isArray(data) || data.some(id => typeof id !== 'string' || !checklist.some(([known]) => known === id))) return []
    return [...new Set(data)] as string[]
  } catch { return [] }
}
export function writeChecklist(storage: StorageAccess, ids: string[]) {
  try { storage.setItem(checklistKey, JSON.stringify(checklist.filter(([id]) => ids.includes(id)).map(([id]) => id))); return true } catch { return false }
}
