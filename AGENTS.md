# Agents Guide

## TypeScript Checking

### Frontend (Vite + React)
The root `tsconfig.json` uses project references with `"files": []`, so bare `tsc --noEmit` checks nothing. Always use:

```sh
npx tsc --noEmit -p tsconfig.app.json
```

### Backend (Express + Neo4j)
```sh
npx tsc --noEmit
```

## Testing

### Backend
```sh
cd backend && npm test
```
