export interface Graph<T> {
    graph: Map<T, T[]>;
    lastUpdated: number;
}

export const createGraph = <T>(): Graph<T> => ({
    graph: new Map(),
    lastUpdated: Date.now(),
});

export const addVertex = <T>(graph: Graph<T>, vertex: T): Graph<T> => {
    if (graph.graph.has(vertex)) {
        return graph;
    }
    graph.graph.set(vertex, []);
    return { ...graph, lastUpdated: Date.now() };
};

// `lastUpdated` is used as a dependency to decide whether downstream work
// (recomputing table nodes) needs to re-run. Bumping it unconditionally —
// as this used to do — made every overlap check a "change" even when
// nothing actually moved, which snowballs into large re-render cascades on
// diagrams with many tables/areas (each position/dimension update re-checks
// overlap against every other table).
export const addEdge = <T>(
    graph: Graph<T>,
    source: T,
    destination: T
): Graph<T> => {
    let changed = false;

    if (!graph.graph.has(source)) {
        graph.graph.set(source, []);
        changed = true;
    }
    if (!graph.graph.has(destination)) {
        graph.graph.set(destination, []);
        changed = true;
    }

    if (!graph.graph.get(source)?.includes(destination)) {
        graph.graph.get(source)?.push(destination);
        changed = true;
    }

    if (!graph.graph.get(destination)?.includes(source)) {
        graph.graph.get(destination)?.push(source);
        changed = true;
    }

    return changed ? { ...graph, lastUpdated: Date.now() } : graph;
};

export const getNeighbors = <T>(graph: Graph<T>, vertex: T): T[] | undefined =>
    graph.graph.get(vertex);

export const removeVertex = <T>(graph: Graph<T>, vertex: T): Graph<T> => {
    if (!graph.graph.has(vertex)) {
        return graph;
    }
    graph.graph.delete(vertex);
    graph.graph.forEach((neighbors) => {
        const index = neighbors.indexOf(vertex);
        if (index !== -1) {
            neighbors.splice(index, 1); // Remove the edge
        }
    });
    return { ...graph, lastUpdated: Date.now() };
};

export const removeEdge = <T>(
    graph: Graph<T>,
    source: T,
    destination: T
): Graph<T> => {
    let changed = false;

    if (graph.graph.has(source)) {
        const index = graph.graph.get(source)?.indexOf(destination) ?? -1;
        if (index !== -1) {
            graph.graph.get(source)?.splice(index, 1);
            changed = true;
        }
    }
    if (graph.graph.has(destination)) {
        const index = graph.graph.get(destination)?.indexOf(source) ?? -1;
        if (index !== -1) {
            graph.graph.get(destination)?.splice(index, 1); // For undirected graph
            changed = true;
        }
    }
    return changed ? { ...graph, lastUpdated: Date.now() } : graph;
};
