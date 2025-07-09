import { requestUrl } from 'obsidian';
import { RaindropSyncSettings } from './main';

const API_BASE_URL = 'https://api.raindrop.io/rest/v1';

export interface RaindropCollection {
    _id: number;
    title: string;
    parent?: {
        $id: number;
    };
}

export interface RaindropHighlight {
    _id: string;
    text: string;
    note: string;
    created: string;
}

export interface RaindropItem {
    _id: number;
    title: string;
    excerpt: string;
    note: string;
    link: string;
    created: string;
    tags: string[];
    highlights: RaindropHighlight[];
}

export const getCollections = async (settings: RaindropSyncSettings): Promise<RaindropCollection[]> => {
    if (!settings.apiToken) {
        throw new Error('Raindrop API token is not set.');
    }

    const response = await requestUrl({
        url: `${API_BASE_URL}/collections`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${settings.apiToken}`
        }
    });

    if (response.status === 200) {
        const data = response.json;
        if (data.items) {
            return data.items;
        }
    }

    throw new Error(`Failed to fetch collections: ${response.status}`);
};

export const getRaindrops = async (settings: RaindropSyncSettings, collectionId: number): Promise<RaindropItem[]> => {
    if (!settings.apiToken) {
        throw new Error('Raindrop API token is not set.');
    }

    // A collectionId of 0 or -1 typically refers to "Unsorted" bookmarks
    const effectiveCollectionId = collectionId === 0 ? -1 : collectionId;

    const response = await requestUrl({
        url: `${API_BASE_URL}/raindrops/${effectiveCollectionId}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${settings.apiToken}`
        }
    });

    if (response.status === 200) {
        const data = response.json;
        if (data.items) {
            return data.items;
        }
    }

    throw new Error(`Failed to fetch raindrops: ${response.status}`);
} 
