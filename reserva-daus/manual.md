# Tenis Fate — Reserva de daus

Manual del joc de taula · Edició d’octubre de 2026

Aquesta és una versió independent de Tenis Fate. Es pot jugar amb tauler, daus i paper, sense ordinador. Les regles del Clàssic es mantenen, excepte la gestió dels daus i la prohibició dels destins impossibles.

## 1. Material i objectiu

- Pista de sis columnes i dues files, amb la xarxa entre les columnes 3 i 4.
- Dos tenistes, una pilota i un marcador de la fila del cop anterior.
- Quatre daus Fate per jugador (vuit en total), o paper per conservar les dues reserves. Cada dau té dues cares −1, dues cares 0 i dues cares +1. Amb daus normals: 1–2 = −1, 3–4 = 0, 5–6 = +1.
- Marcadors d’energia, de punts, de jocs i de sets.

Guanya el partit qui aconsegueix els sets acordats: un set, dos de tres o tres de cinc.

| Zona | Fons esquerre | Centre esquerre | Xarxa esquerra | Xarxa dreta | Centre dret | Fons dret |
|---|---|---|---|---|---|---|
| Fila A | A1: inici blau | A2 | A3 | A4 | A5 | A6 |
| Fila B | B1 | B2 | B3 | B4 | B5 | B6: inici vermell |

Cada tenista queda sempre dins del seu mig camp. La pilota pot compartir casella amb un tenista. Girar el tauler no canvia les regles: les caselles i les distàncies són les mateixes.

## 2. Preparació

Cada tenista comença amb Saque, Restada, General i Voleia a **2**, energia **5**, energia màxima **5** i recuperació **50%**. La versió digital conserva la possibilitat del Clàssic d’ajustar les habilitats entre 1 i 4 en el mode local; per al partit estàndard i contra l’ordinador es comença amb totes a 2. No s’aplica la proposta d’habilitats màximes de 3.

Trieu qui serveix primer i la durada del partit. Col·loqueu els tenistes a A1 i B6, i la pilota amb el servidor. A cada nou punt, els tenistes tornen a aquestes posicions, però conserven l’energia que els queda.

## 3. La reserva de quatre daus

**A l’inici de cada punt, cada jugador tira quatre daus una sola vegada i deixa els resultats visibles.** Les reserves són públiques.

A cada cop esculls **un dau no gastat** de la teva reserva. El resultat és:

**Resultat del cop = habilitat corresponent + valor del dau escollit.**

El dau queda gastat quan fas el cop, tant si és vàlid com si falla. Pots marcar-lo girant-lo a un costat o ratllant-lo al paper. Els altres daus conserven el valor inicial: no es tornen a tirar a cada cop.

Quan hagis gastat els quatre, tira una nova reserva de quatre **a l’inici del teu següent torn** dins del mateix punt. Si el punt acaba abans, descarta tots els sobrants: tots dos jugadors tiren una reserva nova per al punt següent. La reposició automàtica no té cost d’energia.

**Un segon saque pertany al mateix punt:** el dau del primer intent ja està gastat; escull un altre dels que et queden. No recuperes ni els daus ni l’energia gastats en la primera falta.

Exemple: tens −1, 0, +1 i +1. Amb General 2 pots aconseguir respectivament 1, 2, 3 o 3. Si gastes un +1, en queden −1, 0 i +1 per a cops posteriors.

## 4. El servei

El servidor disposa de dos intents per punt i serveix durant tot el joc ordinari.

1. Tria la dificultat del saque (enter entre 1 i 99 en l’aplicació).
2. Escull un dau de la reserva i suma Saque.
3. Si el dau és −1 i gastar 1 d’energia permet salvar el servei, pots convertir-lo en 0.
4. El servei és vàlid si el total iguala o supera la dificultat triada.

El destí del servei és sempre la casella del rival. El valor que rep el rival és la **dificultat triada**, encara que el total sigui superior. Amb Saque 2 i un dau +1, el màxim resultat és 3.

Si falla el primer intent, recol·loca els tenistes a A1 i B6 i torna la pilota al servidor. Pots canviar la dificultat per al segon intent. Si també falla, el receptor guanya el punt. La prohibició de caselles impossibles afecta les devolucions: al servei pots escollir una dificultat que no assoleixis i cometre falta.

Després d’un servei vàlid, anota la fila des d’on has servit i fes el moviment posterior al cop. La primera devolució del receptor utilitza Restada, tret que prepari una volea.

## 5. Arribar a la pilota

Si ja ets a la casella de la pilota, no pagues cap cost.

Per apropar-t’hi, compta els passos ortogonals necessaris: no hi ha diagonals. Amb una distància de **n** caselles, augmentes la dificultat en **n** i gastes **màxim(0, n−1)** d’energia. El primer pas és gratuït d’energia, però afegeix +1 de dificultat. Has de poder pagar tot el desplaçament.

Abans d’apropar-t’hi pots renunciar al punt: el rival el guanya i tu recuperes 1 d’energia, sense superar el màxim. La pèrdua automàtica per manca de destins no dona aquesta recuperació voluntària.

### Voleia

Pots interceptar la pilota sense desplaçar el tenista si la pilota és al teu camp, en una columna més pròxima al teu fons que la teva, i tens almenys 1 d’energia.

Gasta 1 d’energia, porta la pilota a la casella del tenista i augmenta la dificultat en **la meitat de la distància original, arrodonida a la baixa**. Fes servir Voleia. Aquesta acció substitueix el moviment: no paguis també el desplaçament normal. Només es pot preparar una volea per torn.

## 6. Calcular els destins possibles

Després d’arribar a la pilota o preparar una volea, conserva el valor de dificultat com a base i recorda la fila des d’on colpeges. Per a cadascuna de les sis caselles del camp rival, suma els mateixos modificadors del Clàssic:

| Condició | Augment |
|---|---:|
| La fila del destí és diferent de la fila d’origen del cop anterior | +1 |
| El destí és més pròxim al fons rival que el tenista rival | +1 |
| Colpeges des del teu fons i envies al centre rival | +1 |
| Colpeges des del teu fons i envies a la xarxa rival | +2 |
| Colpeges des del teu centre i envies a la xarxa rival | +1 |

Les condicions compatibles se sumen. La dificultat no és només la distància entre pilota i rival.

Per tornar la pilota has d’obtenir **com a mínim dificultat −1**, exactament com al Clàssic. No s’afegeix un límit general de dificultat 4 ni es modifiquen les habilitats.

Una casella és possible amb un dau si el seu resultat arriba al mínim, o si hi arriba convertint un −1 en 0 amb 1 d’energia disponible **després del moviment**.

- Abans de triar dau, mira les caselles que pots assolir amb almenys un dels daus que et queden.
- Després de triar-lo, només pots enviar la pilota a les caselles assolibles amb aquell dau.
- Pots canviar el dau o el destí abans de fer el cop. Recalcula sempre des de la base: no acumules penalitzacions cada vegada que canvies de casella.
- Si un dau no et serveix però un altre sí, pots canviar-lo: no perds el punt pel fet d’haver seleccionat un dau baix.
- Si **cap dau disponible permet cap destí**, fins i tot comptant l’energia, perds el punt. No pots gastar la reserva inútilment per obtenir una tirada nova.

La comprovació es fa quan ja ets a la pilota o has escollit com arribar-hi. Els costos del desplaçament o la volea ja s’han pagat i no es retornen si després no hi ha destí possible.

### Exemple de caselles disponibles

Tens General 2, reserva −1, 0, +1 i +1, i energia 1. Una vegada sumats moviment i posició, tres destins exigeixen dificultats 2, 3 i 4:

| Dau escollit | Total | D2 (mínim 1) | D3 (mínim 2) | D4 (mínim 3) |
|---|---:|---|---|---|
| −1 | 1 | Sí | Sí, gastant 1 energia | No |
| 0 | 2 | Sí | Sí | No |
| +1 | 3 | Sí | Sí | Sí |

Una casella de dificultat 5 seria impossible amb aquesta habilitat i aquesta reserva: exigiria un total mínim de 4.

## 7. Fer i resoldre el cop

Escull el dau i el destí vàlid, suma l’habilitat i marca el dau com a gastat. No hi ha una tirada nova en aquest moment. Un cop jugat el dau, ja no pots canviar el destí ni substituir el dau.

Si cal convertir el −1 en 0 per salvar el cop, paga 1 d’energia i resol. Només es permet gastar aquesta energia quan salva un cop que, sense la millora, fallaria. No pots gastar-la per reforçar un cop que ja és vàlid, ni per salvar-ne un que continuaria sent impossible.

En una devolució vàlida, **el total final es converteix en el nou valor de la pilota**. Actualitza el marcador de fila amb la fila d’origen del teu cop, no amb la del destí.

Després pots moure el tenista **una casella ortogonal gratuïta**, sense sortir del teu mig camp, o quedar-te al lloc. Aquest moviment no altera la dificultat. Passa el torn al rival.

## 8. Marcador i recuperació

Els punts ordinaris són 0, 15, 30 i 40. A 40–40 hi ha iguals; cal guanyar dos punts de diferència. Guanya el set qui arriba a sis jocs amb dos de diferència. A 6–6 es disputa un tie-break: primer a 7 punts amb dos de diferència.

En el tie-break, el servidor inicial fa un punt; després cada tenista serveix dos punts seguits, alternadament. Al set següent comença servint el contrari del servidor inicial del tie-break. Els daus es renoven a cada punt també al tie-break.

Al final d’un joc de **7 punts o menys**, cada jugador recupera el 50% de l’energia que li falta, arrodonit a la baixa. Un joc de més de 7 punts no dona recuperació, llevat que tanqui el set. Al final d’un set sempre hi ha una recuperació. Si el joc tanca el set, s’aplica **una sola vegada**.

Exemple: amb energia 1 i màxim 5, falten 4; recuperes 2 i quedes a 3. Amb energia 4, falta 1; recuperes 0. Anuncia sempre la recuperació de cadascú, inclòs el zero.

## 9. Ús de la versió digital

Obre «Reserva de daus» i inicia una partida de dos jugadors o contra l’ordinador. També pots crear una partida compartida d’aquesta edició. Els enllaços i els guardats són independents dels del Clàssic.

Prem un dels quatre daus de la teva reserva. Els gastats mostren «—». Després de moure’t o preparar la volea, toca una casella disponible o arrossega-hi la pilota. **D** indica la dificultat; les caselles ratllades amb **×** no es poden seleccionar. Prem «Jugar el dau» i després «Resoldre». Si cal salvar el cop, apareix el botó d’energia.

Les fletxes del moviment final sempre segueixen l’orientació visible del tauler. Pots canviar entre horitzontal i vertical sense canviar les caselles lògiques ni els daus.

Contra l’ordinador, controles el blau. El rival vermell combina decisions prudents i arriscades, escull daus de la seva reserva pública i explica el que ha fet en una finestra. Prem «Continuar» després de llegir-la. No coneix els resultats de les futures reserves.

Pots imprimir aquest manual des del navegador o descarregar-ne la versió PDF. Per jugar sense pantalla, cada jugador anota els quatre resultats i ratlla un dau cada vegada que el consumeix.

## 10. Full de consulta

1. Nou punt: posicions inicials i quatre daus nous per jugador.
2. Nou torn: si has gastat els quatre daus, tira una reserva nova.
3. Apropa’t, prepara una volea o renuncia.
4. Calcula els destins possibles amb els daus i l’energia restants.
5. Cap destí amb cap dau: punt per al rival.
6. Tria dau i destí; consumeix el dau en fer el cop.
7. Si cal i és possible, paga 1 energia per convertir −1 en 0.
8. Resol, actualitza dificultat i fila d’origen; fes el moviment gratuït.
9. Passa el torn. Conserva els daus no gastats fins al final del punt.

**Full de reserva per copiar:**

| Jugador | Dau 1 | Dau 2 | Dau 3 | Dau 4 | Energia |
|---|---|---|---|---|---|
| Blau | ___ | ___ | ___ | ___ | ___ / 5 |
| Vermell | ___ | ___ | ___ | ___ | ___ / 5 |

Dificultat base: ___ · Modificadors: ___ · Dificultat final: ___

Habilitat: ___ · Dau: ___ · Millora amb energia: ___ · Total: ___

Fila d’origen del cop anterior: ___ · Destí: ___ · Servidor: ___
