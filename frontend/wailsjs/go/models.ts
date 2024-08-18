export namespace main {
	
	export class PtySize {
	    rows: number;
	    cols: number;
	    pixelWidth: number;
	    pixelHeight: number;
	
	    static createFrom(source: any = {}) {
	        return new PtySize(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rows = source["rows"];
	        this.cols = source["cols"];
	        this.pixelWidth = source["pixelWidth"];
	        this.pixelHeight = source["pixelHeight"];
	    }
	}
	export class TerminalConfig {
	    size?: PtySize;
	    command: string;
	    args: string[];
	    cwd?: string;
	
	    static createFrom(source: any = {}) {
	        return new TerminalConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.size = this.convertValues(source["size"], PtySize);
	        this.command = source["command"];
	        this.args = source["args"];
	        this.cwd = source["cwd"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

