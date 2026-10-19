"""Rotas dos abrigos oficiais da Defesa Civil. Ativadas em main.py com app.include_router(abrigos_oficiais_router).

GET    /api/v1/abrigos-oficiais?lat=&lon=&raioKm=   público (o cidadão vê os oficiais perto dele)
POST   /api/v1/abrigos-oficiais                     gestão (exige o código do operador)
POST   /api/v1/abrigos-oficiais/{id}/status         gestão: muda o status (aberto, lotado, fechado)
POST   /api/v1/abrigos-oficiais/{id}/remover        gestão: remove
(Só GET e POST: é o que o CORS da API libera.)
"""
from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .abrigos_oficiais import AbrigosOficiais, Invalido

router = APIRouter(prefix="/api/v1/abrigos-oficiais", tags=["abrigos-oficiais"])
_NO_STORE = {"Cache-Control": "no-store"}
_repo = AbrigosOficiais()


class NovoLocal(BaseModel):
    tipo: str = Field(max_length=20)
    nome: str = Field(max_length=120)
    endereco: str | None = Field(default=None, max_length=200)
    latitude: float
    longitude: float
    status: str = Field(default="aberto", max_length=10)
    capacidade: int | None = None
    raioM: int | None = None
    observacao: str | None = Field(default=None, max_length=240)
    codigo: str = Field(max_length=100)


class NovoStatus(BaseModel):
    status: str = Field(max_length=10)
    codigo: str = Field(max_length=100)


class Remocao(BaseModel):
    codigo: str = Field(max_length=100)


def _erro(status, codigo, mensagem):
    return JSONResponse(status_code=status, headers=_NO_STORE, content={"error": {"code": codigo, "message": mensagem}})


async def _rodar(funcao, *args):
    try:
        return JSONResponse(content=await run_in_threadpool(funcao, *args), headers=_NO_STORE)
    except Invalido as e:
        return _erro(422, "invalid_request", str(e))
    except PermissionError:
        return _erro(403, "forbidden", "Código do operador incorreto.")
    except LookupError:
        return _erro(404, "not_found", "Local não encontrado.")
    except Exception:  # nunca vaza detalhes internos
        return _erro(503, "unavailable", "Cadastro de abrigos indisponível agora. Tente de novo em instantes.")


@router.get("")
async def listar(lat: float | None = None, lon: float | None = None, raioKm: float | None = None):
    return await _rodar(_repo.listar, lat, lon, raioKm)


@router.post("")
async def criar(body: NovoLocal):
    dados = (body.model_dump if hasattr(body, "model_dump") else body.dict)(exclude={"codigo"})
    return await _rodar(_repo.criar, dados, body.codigo)


@router.post("/{ident}/status")
async def mudar_status(ident: int, body: NovoStatus):
    return await _rodar(_repo.mudar_status, ident, body.status, body.codigo)


@router.post("/{ident}/remover")
async def remover(ident: int, body: Remocao):
    return await _rodar(_repo.remover, ident, body.codigo)
