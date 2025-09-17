
# light wrapper calling dslockctl for lock contention
import subprocess, time, random, os, json, multiprocessing as mp, sys
DS = sys.argv[1] if len(sys.argv) > 1 else "VOL/APP/FILE"
NPROC = int(os.environ.get("NPROC", "8"))
ITER  = int(os.environ.get("ITER",  "50"))
LEVELS = ["SHR", "OLD", "MOD"]
LEVEL_WEIGHT = [0.7, 0.15, 0.15]
def sh(*args): return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
def lock(ds, lv): return sh("./build/dslockctl", "lock", ds, lv)
def unlock(ds):   return sh("./build/dslockctl", "unlock", ds)
def worker(idx, q):
    ok = conf = err = 0
    rnd = random.Random(idx ^ int(time.time()))
    for _ in range(ITER):
        lv = rnd.choices(LEVELS, weights=LEVEL_WEIGHT, k=1)[0]
        r = lock(DS, lv)
        if r.returncode == 0:
            ok += 1
            time.sleep(rnd.random()/50)
            unlock(DS)
        elif r.returncode == 1:
            conf += 1
        else:
            err += 1
    q.put((ok, conf, err))

def main():
    q = mp.Queue()
    ps = [ mp.Process(target=worker, args=(i,q)) for i in range(NPROC) ]
    for p in ps: p.start()
    for p in ps: p.join()
    ok=conf=err=0
    while not q.empty():
        a,b,c=q.get(); ok+=a; conf+=b; err+=c
    print("ok",ok,"conflicts",conf,"errors",err)
if __name__=="__main__":
    main()
