Some time ago I stumbled upon a great series of blog posts about making code faster (https://ayende.com/blog/176034/making-code-faster-the-interview-question) the problem described there is easy to understand and the results of performance optimizations are quite impressive. 
I decided that this example would be a great base for my adventure in exploration of tools for performance analysis in go, so if you are also interested tag along :)

1. The problem
Problem as I mentioned is quite simple. Given a text file of parking lot entries calculate how much time each car spend in it.
The file consist of lines (delimited by CRLF) and each line has three columns: time of entry, time of leave and car id.

```
2015-01-01T16:44:31 2015-01-01T19:09:14 00043064
2015-01-01T04:20:01 2015-01-01T05:04:50 00192676
2015-01-01T09:07:08 2015-01-01T10:32:53 00165147
2015-01-01T00:43:35 2015-01-01T01:01:05 00184024
2015-01-01T20:31:41 2015-01-01T22:39:05 00098557
2015-01-01T14:01:02 2015-01-01T15:26:16 00019519
2015-01-01T10:56:23 2015-01-01T12:23:57 00112591
2015-01-01T11:55:57 2015-01-01T12:47:59 00052067
2015-01-01T01:31:48 2015-01-01T03:28:07 00181835
2015-01-01T10:12:43 2015-01-01T12:36:07 00135455
```

2. First solution
The straight forward solution could look like this: 

```go
type carRecord struct {
	Start time.Time
	End   time.Time
	ID    int
}

func newCarRecord(line string) carRecord {
	parts := strings.Split(line, " ")

	start, _ := time.Parse("2006-01-02T15:04:05", parts[0])
	end, _ := time.Parse("2006-01-02T15:04:05", parts[1])
	id, _ := strconv.Atoi(parts[2])

	return carRecord{start, end, id}
}

func report(in, out string) {
	bytes, _ := ioutil.ReadFile(in)
	content := string(bytes)
	lines := strings.Split(content, "\r\n")

	durations := make(map[int]float64)

	for _, line := range lines {
		if line != "" {
			record := newCarRecord(line)
			duration := record.End.Sub(record.Start).Seconds()
			if _, ok := durations[record.ID]; ok {
				durations[record.ID] += duration
			} else {
				durations[record.ID] = duration
			}
		}
	}

	var sb strings.Builder
	for id, duration := range durations {
		sb.WriteString(fmt.Sprintf("%d %.0f\r\n", id, duration))
	}

	ioutil.WriteFile(out, []byte(sb.String()), 0644)
}
```

This code reads the whole file into memory, splits it by lines, parses each line, calculates duration for each car, sums it with previousely calculated ones and writes results to another file.

Execution of this program takes on my machine around 5,3s.

Fun fuct try to replace string.Builder with string concatenation like this:

```go
output := ""
for id, duration := range durations {
	output += fmt.Sprintf("%d %.0f\r\n", id, duration)
}
```
and see what happens, spoiler alert: it then takes around 50s to execute
I guess its true what some dude on the internet said:
> Unnecessary memory allocation makes someone cry

2. Second solution
Ok ~5,3s is not that bad but since we know it can be faster it would be a sin not to try.
One of the things go is famous for is its support for concurrency so lets try that.
We will create workers responsible for calculations for given batch of lines.

```go
func report(inFileName, outFileName string) {
	bytes, _ := ioutil.ReadFile(inFileName)
	content := string(bytes)
	lines := strings.Split(content, "\r\n")

	durations := make(map[int]float64)
	wg := sync.WaitGroup{}
	mu := sync.Mutex{}
	noOfWorkers := 4 // just arbitrary number of workers 
	cWork := make(chan []string, 100) // channel on which we will be sending batches for workers

	for i := 0; i < noOfWorkers; i++ {
		go func() { // worker code - receives batch of lines, calculates duration for car and sums it up with previousely calculated values
			for dataBatch := range cWork {
				for x := 0; x < len(dataBatch); x++ {
					line := dataBatch[x]
					record := newCarRecord(line)
					duration := record.End.Sub(record.Start).Seconds()
					mu.Lock() // we have to lock modifications on shared map
					durations[record.ID] += duration
					mu.Unlock()
				}
			}

			wg.Done()
		}()
	}

	wg.Add(noOfWorkers)

	noOfLines := len(lines) - 1 // because we know that the last line is empty
	batchSize := 100000 // arbitrary number of lines we would like to process in a batch
	noOfBatches := int(noOfLines / batchSize)

	for x := 0; x < noOfBatches; x++ {
		startAt := x * batchSize
		cWork <- lines[startAt : startAt+batchSize]
	}

	if noOfBatches*batchSize < noOfLines {
		cWork <- lines[noOfBatches*batchSize : noOfLines]
	}

	close(cWork)

	wg.Wait()

	var sb strings.Builder
	for id, duration := range durations {
		sb.WriteString(fmt.Sprintf("%d %.0f\r\n", id, duration))
	}

	ioutil.WriteFile(outFileName, []byte(sb.String()), 0644)
}
```

This runs in ~3,7s. Better but I would expect more :)
We know what our program is conceptually doing (code tells us that) but can we know what it its really doing ? Sure we can! And here comes the first tool we will use: trace.
"Trace is a tool for viewing trace files" (dugh! - thanks https://golang.org/cmd/trace/ :) ).
So what are the trace files ? Trace file is a file with information about go runtime events occured during execution like garbage collections, heap size, scheduling etc
Enough theory lets generate trace file from the execution of our program.

We have several options:
 - explicitly tell our program to emit events to given file using [runtime/trace](https://godoc.org/runtime/trace) package
 - using net/http/pprof if we are creating web services
 - let go test tool gather trace for us 

Since I already have a benchmark laying aroung which I used for measuring the execution time (yep using benchmark for time measuring in this case is a bit of overcomplication but since this is an expliration who's going to stop me)

```go
package main

import "testing"

func BenchmarkReport(b *testing.B) {
	for n := 0; n < b.N; n++ {
		report("data.txt", "summary.txt")
	}
}
```

I will use the third option to generate trace.

```
> go test -bench=BenchmarkReport -trace trace.out
```

Now when we have trace file available lets run trace tool 

```
> go tool trace trace.out
```

This opens a browser. Lets click on "View trace".

Note: the trace viewer part of the trace tool works only in Chromium browsers (Chrome).

This is what you should see in the browser:

![trace_concurrent_1.png](trace_concurrent_1.png)

First section shows you usage of goroutines, heap and threads over time (you guessed it! bigger the bars are the more resource of a type is used).
The second section shows our go routines work over processor cores.
For navigation WSAD keys are used (for more options hit "?" key).
Elements on this screen are clicable if we click around in Proc section we might see the stack trace showing which piece of our code is responsible for the work.
After closer look two things came to my mind. First it takes aroung 600ms to prepare the data (read from file and split by lines), second there is a lot of work related to locking we do when we are modifying durations map.

![trace_with_stacktrace.png](trace_with_stacktrace.png)

Lets try to do something about it.

3. Third solution
The next improvement idea is not to read whole file upfront but to read batches of file and send them to process to workers. Each worker will calculate durations based on data batch and send the result to go routine responsible for merging those partial results into one.

```go
func report(in, out string) {
	inFile, _ := os.Open(in)
	defer inFile.Close()

	durations := make(map[int]float64)

	lineLen := 50
	dataInLineLen := 48 // dont count \r\n
	noOfWorkers := 4
	cWork := make(chan []byte, 100)
	cDurations := make(chan map[int]float64, noOfWorkers)
	wg := sync.WaitGroup{}

	for i := 0; i < noOfWorkers; i++ {
		go func() {
			localDurations := make(map[int]float64)
			for dataRange := range cWork {
				for x := 0; x < len(dataRange); x += lineLen {
					line := string(dataRange[x : x+dataInLineLen])
					record := newCarRecord(line)
					duration := record.End.Sub(record.Start).Seconds()
					localDurations[record.ID] += duration
				}
			}
			cDurations <- localDurations
			wg.Done()
		}()
	}

	wg.Add(noOfWorkers)

	batchSize := 100000

	for {
		buf := make([]byte, batchSize)
		read, err := inFile.Read(buf)

		if err == io.EOF {
			break
		}

		cWork <- buf[:read]
	}

	close(cWork)

	wg.Wait()

	for i := 0; i < noOfWorkers; i++ {
		d := <-cDurations
		for id, duration := range d {
			durations[id] += duration
		}
	}

	var sb strings.Builder
	for id, duration := range durations {
		sb.WriteString(fmt.Sprintf("%d %.0f\r\n", id, duration))
	}

	ioutil.WriteFile(out, []byte(sb.String()), 0644)
}
```

takes around 3s, lets take a look (entering pprof + web with flame graphs)

command line like a boss

```bash
> go tool pprof cpu.out 
File: making-code-faster.test
Type: cpu
Time: Aug 25, 2019 at 12:30pm (CEST)
Duration: 2.95s, Total samples = 6.67s (225.96%)
Entering interactive mode (type "help" for commands, "o" for options)
(pprof) top
Showing nodes accounting for 4890ms, 73.31% of 6670ms total
Dropped 68 nodes (cum <= 33.35ms)
Showing top 10 nodes out of 60
      flat  flat%   sum%        cum   cum%
    1730ms 25.94% 25.94%     4010ms 60.12%  time.parse
     980ms 14.69% 40.63%      980ms 14.69%  time.nextStdChunk
     720ms 10.79% 51.42%      880ms 13.19%  runtime.mapassign_fast64
     360ms  5.40% 56.82%      360ms  5.40%  time.skip
     240ms  3.60% 60.42%      270ms  4.05%  runtime.heapBitsSetType
     230ms  3.45% 63.87%      410ms  6.15%  time.Date
     190ms  2.85% 66.72%      710ms 10.64%  runtime.mallocgc
     150ms  2.25% 68.97%     4980ms 74.66%  github.com/michaldziurowski/making-code-faster.newCarRecord
     150ms  2.25% 71.21%      270ms  4.05%  time.getnum
     140ms  2.10% 73.31%      140ms  2.10%  time.isDigit
(pprof) 

```

web view

![pprof_web_view.png](pprof_web_view.png)

flame graph 

![pprof_flame_graph.png](pprof_flame_graph.png)

What we learned is that our program spends much time in time.parse. It seems that we could do substraction by ourselfs and see it that helps

```go
func newCarRecord(b []byte) (int, float64) {
	start := parseTime(b[:19])
	end := parseTime(b[20:39])
	id := from8Bytes(b[40:48])

	return id, end.Sub(start).Seconds()
}

func parseTime(b []byte) time.Time {
	y := from4Bytes(b[:4])
	m := time.Month(from2Bytes(b[5:7]))
	d := from2Bytes(b[8:10])
	h := from2Bytes(b[11:13])
	mi := from2Bytes(b[14:16])
	s := from2Bytes(b[17:19])
	return time.Date(y, m, d, h, mi, s, 0, time.UTC)
}

func from2Bytes(by []byte) int {
	return int(by[0]-'0')*10 + int(by[1]-'0')
}

func from4Bytes(by []byte) int {
	return int(by[0]-'0')*1000 + int(by[1]-'0')*100 + int(by[2]-'0')*10 + int(by[3]-'0')
}

func from8Bytes(by []byte) int {
	return int(by[0]-'0')*10000000 + int(by[1]-'0')*1000000 + int(by[2]-'0')*1000000 + int(by[3]-'0')*10000 + int(by[4]-'0')*1000 + int(by[5]-'0')*100 + int(by[6]-'0')*10 + int(by[7]-'0')
}
```

seems ugly but runs in ~0,75s

mention super fast with mmap, mention docerized
